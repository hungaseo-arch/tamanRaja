<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { RefreshCw, UserPlus } from 'lucide-vue-next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/composables/useAuth';
import { useCompactTable } from '@/composables/useCompactTable';
import { useToast } from '@/composables/useToast';
import { ROUTE_PATHS } from '@/lib';
import { describeError } from '@/lib/errors';
import { DASH } from '@/lib/format';
import AsyncState from '@/components/ui/AsyncState.vue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import Card from '@/components/ui/Card.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Dialog from '@/components/ui/Dialog.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Select from '@/components/ui/Select.vue';
import Table from '@/components/ui/Table.vue';
import TableHeader from '@/components/ui/TableHeader.vue';
import TableBody from '@/components/ui/TableBody.vue';
import TableRow from '@/components/ui/TableRow.vue';
import TableHead from '@/components/ui/TableHead.vue';
import TableCell from '@/components/ui/TableCell.vue';
import RowDetailDialog from '@/components/ui/RowDetailDialog.vue';
import RowDetailButton from '@/components/ui/RowDetailButton.vue';
import DetailItem from '@/components/ui/DetailItem.vue';

/**
 * 회원 관리 (관리자 전용).
 *
 * members 를 직접 select 하지 않고 admin_members() RPC 로 읽는다. anon 에게
 * members.role 의 SELECT 권한이 없어서(P1-2 의 컬럼 단위 권한) 등급을 볼 방법이
 * 그것뿐이고, 쓰기도 정책이 아니라 RPC 로만 열려 있다. 아래 라우팅 가드는
 * 편의일 뿐 권한 경계가 아니다 — 서버가 다시 판정한다.
 */

const router = useRouter();
const { isLoggedIn, isAdmin, currentMember } = useAuth();
const { toast } = useToast();

if (!isLoggedIn.value) router.replace(ROUTE_PATHS.HOME);
else if (!isAdmin.value) router.replace(ROUTE_PATHS.MONTHLY);

interface AdminMemberRow {
  id: number;
  name: string;
  role: 'admin' | 'member';
  enrollment_year: number | null;
  /** 휴면 시작월(YYYY-MM). 현역이면 null. */
  dormant_from: string | null;
  result_count: number;
  hosted_count: number;
  last_login_at: string | null;
}

// ── 조회 ─────────────────────────────────────────────────────────────────────
const rows = ref<AdminMemberRow[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
/** 어느 줄에 요청이 나가 있는지. 그 줄의 버튼만 잠근다. */
const busyId = ref<number | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;

  const { data, error: rpcError } = await supabase.rpc('admin_members');

  if (rpcError) {
    // 권한 없음(42501)도 그대로 보여준다. 빈 표로 두면 회원이 없는 것과
    // 구분되지 않는다.
    error.value = describeError(rpcError, '회원 목록을 불러오지 못했습니다.');
    rows.value = [];
  } else {
    rows.value = (data ?? []) as AdminMemberRow[];
  }
  loading.value = false;
}

onMounted(() => void load());

const adminCount = computed(() => rows.value.filter((r) => r.role === 'admin').length);

// ── 실패 사유 문구 ───────────────────────────────────────────────────────────
// 서버가 돌려주는 reason 을 사람 말로 옮긴다. 사유를 감추고 "실패했습니다" 만
// 띄우면 왜 막혔는지 알 수 없어 같은 시도를 반복하게 된다.
const REASONS: Record<string, string> = {
  invalid_name: '이름을 확인해주세요. (1~50자)',
  duplicate_name: '같은 이름의 회원이 이미 있습니다.',
  invalid_std_hc: '기준핸디는 0~54 사이의 숫자여야 합니다.',
  invalid_month: '월은 YYYY-MM 형식이어야 합니다.',
  invalid_role: '등급 값이 올바르지 않습니다.',
  not_found: '이미 삭제된 회원입니다.',
  self: '본인 계정은 삭제할 수 없습니다.',
  self_demote: '본인 등급은 스스로 내릴 수 없습니다.',
  last_admin: '마지막 관리자입니다. 다른 회원을 먼저 관리자로 올려주세요.',
};

function describeReason(reason: string | undefined, fallback: string): string {
  return (reason && REASONS[reason]) || fallback;
}

interface RpcResult {
  ok: boolean;
  reason?: string;
  result_count?: number;
  hosted_count?: number;
}

/**
 * 회원 관리 RPC 공통 호출. 실패는 전부 토스트로 알린다 —
 * 조용히 넘어가면 표가 그대로라 성공한 것처럼 보인다.
 */
async function callRpc(
  fn: string,
  args: Record<string, unknown>,
  fallback: string
): Promise<RpcResult | null> {
  const { data, error: rpcError } = await supabase.rpc(fn, args);

  if (rpcError) {
    toast({ title: fallback, description: describeError(rpcError, ''), variant: 'destructive' });
    return null;
  }

  const res = (data ?? null) as RpcResult | null;
  if (!res) {
    toast({ title: fallback, description: '서버 응답이 비어 있습니다.', variant: 'destructive' });
    return null;
  }
  return res;
}

// ── 회원 추가 ────────────────────────────────────────────────────────────────
// 기준핸디와 시작월을 함께 받는 이유: monthly_handicaps 행이 없으면 월간 기록
// 표가 그 회원을 통째로 건너뛴다. 추가는 됐는데 화면에 안 보이는 상태가 된다.
const addOpen = ref(false);
const addName = ref('');
const addStdHc = ref('');
const addYear = ref(String(new Date().getFullYear()));
const addMonth = ref(currentYearMonth());
// Select 는 문자열만 주고받는다. 좁은 타입으로 두면 v-model 이 타입 검사에서 막힌다.
const addRole = ref('member');
const addSaving = ref(false);
const addError = ref<string | null>(null);

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function openAdd(): void {
  addName.value = '';
  addStdHc.value = '';
  addYear.value = String(new Date().getFullYear());
  addMonth.value = currentYearMonth();
  addRole.value = 'member';
  addError.value = null;
  addOpen.value = true;
}

async function submitAdd(): Promise<void> {
  addError.value = null;
  addSaving.value = true;

  const res = await callRpc(
    'add_member',
    {
      p_name: addName.value,
      p_std_hc: addStdHc.value === '' ? null : Number(addStdHc.value),
      p_enrollment_year: addYear.value === '' ? null : Number(addYear.value),
      p_start_month: addMonth.value,
      p_role: addRole.value,
    },
    '회원을 추가하지 못했습니다.'
  );
  addSaving.value = false;

  if (!res) return;
  if (!res.ok) {
    // 모달 안에 남긴다. 토스트는 몇 초 뒤 사라져 무엇을 고쳐야 할지 잊힌다.
    addError.value = describeReason(res.reason, '회원을 추가하지 못했습니다.');
    return;
  }

  addOpen.value = false;
  toast({
    title: `${addName.value} 회원을 추가했습니다.`,
    description: '초기 PIN 은 기본값입니다. 본인에게 첫 로그인 후 변경을 안내해주세요.',
  });
  await load();
}

// ── 등급 변경 ────────────────────────────────────────────────────────────────
async function toggleRole(row: AdminMemberRow): Promise<void> {
  const next = row.role === 'admin' ? 'member' : 'admin';
  busyId.value = row.id;

  const res = await callRpc(
    'set_member_role',
    { p_member_id: row.id, p_role: next },
    '등급을 바꾸지 못했습니다.'
  );
  busyId.value = null;

  if (!res) return;
  if (!res.ok) {
    toast({
      title: '등급을 바꾸지 못했습니다.',
      description: describeReason(res.reason, ''),
      variant: 'destructive',
    });
    return;
  }

  toast({ title: `${row.name} · ${next === 'admin' ? '관리자' : '회원'}로 바꿨습니다.` });
  await load();
}

// ── 휴면 · 복귀 ──────────────────────────────────────────────────────────────
// 기록이 있는 회원을 명단에서 빼는 정상 경로다. 지난 기록은 그대로 두고
// 그 달 이후의 집계·랭킹·로그인 목록에서만 빠진다.
const dormantOpen = ref(false);
const dormantRow = ref<AdminMemberRow | null>(null);
const dormantMonth = ref(currentYearMonth());
const dormantSaving = ref(false);
const dormantError = ref<string | null>(null);

function openDormant(row: AdminMemberRow): void {
  dormantRow.value = row;
  dormantMonth.value = row.dormant_from ?? currentYearMonth();
  dormantError.value = null;
  dormantOpen.value = true;
}

async function submitDormant(): Promise<void> {
  const row = dormantRow.value;
  if (!row) return;

  dormantError.value = null;
  dormantSaving.value = true;
  const res = await callRpc(
    'set_member_dormant',
    { p_member_id: row.id, p_from: dormantMonth.value },
    '휴면 처리를 하지 못했습니다.'
  );
  dormantSaving.value = false;

  if (!res) return;
  if (!res.ok) {
    dormantError.value = describeReason(res.reason, '휴면 처리를 하지 못했습니다.');
    return;
  }

  dormantOpen.value = false;
  toast({ title: `${row.name} · ${dormantMonth.value}부터 휴면으로 바꿨습니다.` });
  await load();
}

/** 휴면 해제. 되돌리기 쉬운 조작이라 별도 확인 없이 바로 처리한다. */
async function restore(row: AdminMemberRow): Promise<void> {
  busyId.value = row.id;
  const res = await callRpc(
    'set_member_dormant',
    { p_member_id: row.id, p_from: null },
    '복귀 처리를 하지 못했습니다.'
  );
  busyId.value = null;

  if (!res) return;
  if (!res.ok) {
    toast({
      title: '복귀 처리를 하지 못했습니다.',
      description: describeReason(res.reason, ''),
      variant: 'destructive',
    });
    return;
  }

  toast({ title: `${row.name} 회원을 현역으로 되돌렸습니다.` });
  await load();
}

// ── 삭제 ─────────────────────────────────────────────────────────────────────
// 기록이 하나라도 있으면 서버가 거절한다. members 를 참조하는 FK 가 전부
// cascade 라, 막지 않으면 삭제 한 번에 그 회원의 점수·핸디가 함께 사라진다.
// 화면에서도 미리 막아 두지만 최종 판정은 서버다.
const deleteOpen = ref(false);
const deleteRow = ref<AdminMemberRow | null>(null);
const deleteSaving = ref(false);
const deleteError = ref<string | null>(null);

function deletable(row: AdminMemberRow): boolean {
  return (
    row.result_count === 0 &&
    row.hosted_count === 0 &&
    String(row.id) !== currentMember.value?.id
  );
}

function openDelete(row: AdminMemberRow): void {
  deleteRow.value = row;
  deleteError.value = null;
  deleteOpen.value = true;
}

async function submitDelete(): Promise<void> {
  const row = deleteRow.value;
  if (!row) return;

  deleteError.value = null;
  deleteSaving.value = true;
  const res = await callRpc(
    'delete_member',
    { p_member_id: row.id },
    '회원을 삭제하지 못했습니다.'
  );
  deleteSaving.value = false;

  if (!res) return;
  if (!res.ok) {
    deleteError.value =
      res.reason === 'has_records'
        ? `경기 기록이 ${res.result_count ?? 0}건 있어 삭제할 수 없습니다. 휴면 처리를 쓰세요.`
        : describeReason(res.reason, '회원을 삭제하지 못했습니다.');
    return;
  }

  deleteOpen.value = false;
  toast({ title: `${row.name} 회원을 삭제했습니다.` });
  await load();
}

// ── 표기 ─────────────────────────────────────────────────────────────────────
const ROLE_OPTIONS = [
  { value: 'member', label: '회원' },
  { value: 'admin', label: '관리자' },
] as const;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatLastLogin(iso: string | null): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function statusLabel(row: AdminMemberRow): string {
  return row.dormant_from ? `휴면 ${row.dormant_from}~` : '현역';
}

// ── 줄 상세 ──────────────────────────────────────────────────────────────────
// 좁은 화면에서는 가입·기록·마지막 로그인 열이 숨는다. 이름을 누르면 통째로 본다.
const compact = useCompactTable('sm');
const detailRow = ref<AdminMemberRow | null>(null);
const detailOpen = ref(false);

function openDetail(row: AdminMemberRow): void {
  detailRow.value = row;
  detailOpen.value = true;
}

watch(compact, (isCompact) => {
  if (!isCompact) detailOpen.value = false;
});
</script>

<template>
  <div class="w-full bg-background">
    <div class="container mx-auto px-4 py-2 max-w-5xl space-y-3">
      <div class="flex items-center gap-2 pt-1">
        <h1 class="text-lg font-bold text-foreground mr-auto">
          회원 관리 <span class="text-muted-foreground font-medium text-sm">— 관리자</span>
        </h1>
        <Button variant="default" size="xs" class="shrink-0 gap-1" @click="openAdd()">
          <UserPlus class="w-3.5 h-3.5" aria-hidden="true" />
          회원 추가
        </Button>
        <Button
          variant="outline"
          size="xs"
          class="shrink-0 gap-1"
          :disabled="loading"
          aria-label="회원 목록 다시 불러오기"
          @click="load()"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="loading ? 'animate-spin' : ''" aria-hidden="true" />
          <span class="hidden sm:inline">새로고침</span>
        </Button>
      </div>

      <Card class="w-min min-w-full">
        <CardContent class="px-2 sm:px-6">
          <AsyncState
            :loading="loading"
            :error="error"
            :empty="rows.length === 0"
            label="회원 목록"
            :skeleton-rows="8"
            empty-title="회원이 없습니다"
            container-class="py-6"
            @retry="load()"
          >
            <div class="pt-4">
              <Table
                :scroll="false"
                class="text-xs sm:text-sm [&_thead_th]:bg-muted [&_thead_th]:text-foreground"
                caption="회원 명단과 등급"
              >
                <TableHeader>
                  <TableRow>
                    <TableHead class="font-bold text-foreground whitespace-nowrap">이름</TableHead>
                    <TableHead class="font-bold text-center whitespace-nowrap">등급</TableHead>
                    <TableHead class="font-bold text-center whitespace-nowrap">상태</TableHead>
                    <TableHead class="font-bold text-center whitespace-nowrap hidden sm:table-cell">가입</TableHead>
                    <TableHead class="font-bold text-center whitespace-nowrap hidden sm:table-cell">기록</TableHead>
                    <TableHead class="font-bold text-center whitespace-nowrap hidden sm:table-cell">마지막 로그인</TableHead>
                    <TableHead class="font-bold text-right whitespace-nowrap">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="row in rows" :key="row.id" class="hover:bg-muted/50 transition-colors">
                    <TableCell class="font-medium whitespace-nowrap">
                      <RowDetailButton
                        :label="`${row.name} 상세`"
                        :enabled="compact"
                        @click="openDetail(row)"
                      >{{ row.name }}</RowDetailButton>
                    </TableCell>
                    <TableCell class="text-center whitespace-nowrap">
                      <Badge :variant="row.role === 'admin' ? 'default' : 'secondary'">
                        {{ row.role === 'admin' ? '관리자' : '회원' }}
                      </Badge>
                    </TableCell>
                    <TableCell class="text-center whitespace-nowrap">
                      <span :class="row.dormant_from ? 'text-muted-foreground' : ''">
                        {{ statusLabel(row) }}
                      </span>
                    </TableCell>
                    <TableCell class="text-center font-mono whitespace-nowrap hidden sm:table-cell">
                      {{ row.enrollment_year ?? DASH }}
                    </TableCell>
                    <TableCell class="text-center font-mono whitespace-nowrap hidden sm:table-cell">
                      {{ row.result_count }}
                    </TableCell>
                    <TableCell class="text-center font-mono whitespace-nowrap hidden sm:table-cell text-muted-foreground">
                      {{ formatLastLogin(row.last_login_at) }}
                    </TableCell>
                    <TableCell class="text-right whitespace-nowrap">
                      <div class="inline-flex gap-1">
                        <Button
                          variant="outline"
                          size="xs"
                          :disabled="busyId === row.id"
                          :title="row.role === 'admin' ? '회원으로 내리기' : '관리자로 올리기'"
                          @click="toggleRole(row)"
                        >
                          {{ row.role === 'admin' ? '회원으로' : '관리자로' }}
                        </Button>
                        <Button
                          v-if="row.dormant_from"
                          variant="outline"
                          size="xs"
                          :disabled="busyId === row.id"
                          title="현역으로 되돌리기"
                          @click="restore(row)"
                        >복귀</Button>
                        <Button
                          v-else
                          variant="outline"
                          size="xs"
                          :disabled="busyId === row.id"
                          title="이 달부터 집계에서 제외"
                          @click="openDormant(row)"
                        >휴면</Button>
                        <Button
                          variant="destructive"
                          size="xs"
                          :disabled="busyId === row.id || !deletable(row)"
                          :title="deletable(row) ? '회원 삭제' : '기록이 있어 삭제할 수 없습니다 (휴면을 쓰세요)'"
                          @click="openDelete(row)"
                        >삭제</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <p class="text-xs text-muted-foreground mt-2 px-4">
                {{ rows.length }}명 · 관리자 {{ adminCount }}명 ·
                기록이 있는 회원은 삭제되지 않습니다. 명단에서 빼려면 휴면을 쓰세요.
              </p>
            </div>
          </AsyncState>
        </CardContent>
      </Card>

      <!-- 회원 추가 -->
      <Dialog v-model:open="addOpen" label="회원 추가" content-class="sm:max-w-sm">
        <div class="px-1 pt-1 space-y-3">
          <h2 class="text-base font-bold">회원 추가</h2>
          <div class="space-y-1">
            <Label for="add-name">이름</Label>
            <Input id="add-name" v-model="addName" :maxlength="50" placeholder="회원 이름" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <Label for="add-std-hc">기준핸디</Label>
              <Input id="add-std-hc" v-model="addStdHc" inputmode="numeric" placeholder="예: 24" />
            </div>
            <div class="space-y-1">
              <Label for="add-year">가입연도</Label>
              <Input id="add-year" v-model="addYear" inputmode="numeric" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <Label for="add-month">시작월</Label>
              <Input id="add-month" v-model="addMonth" placeholder="YYYY-MM" />
            </div>
            <div class="space-y-1">
              <Label for="add-role">등급</Label>
              <Select id="add-role" v-model="addRole" :options="[...ROLE_OPTIONS]" :placeholder="''" />
            </div>
          </div>

          <p class="text-xs text-muted-foreground">
            시작월부터 월간 기록 표에 나옵니다. 초기 PIN 은 기본값이며, 첫 로그인 후
            계정 창에서 본인이 바꾸도록 안내해주세요.
          </p>

          <p v-if="addError" class="text-xs text-destructive">{{ addError }}</p>

          <div class="flex justify-end gap-2 pt-1">
            <Button variant="outline" :disabled="addSaving" @click="addOpen = false">취소</Button>
            <Button :disabled="addSaving" @click="submitAdd()">
              {{ addSaving ? '추가하는 중…' : '추가' }}
            </Button>
          </div>
        </div>
      </Dialog>

      <!-- 휴면 처리 -->
      <Dialog v-model:open="dormantOpen" label="휴면 처리" content-class="sm:max-w-sm">
        <div class="px-1 pt-1 space-y-3">
          <h2 class="text-base font-bold">휴면 처리</h2>
          <p class="text-sm">
            <span class="font-medium">{{ dormantRow?.name }}</span> 회원을 아래 달부터
            집계·랭킹·로그인 목록에서 제외합니다. 지난 기록은 그대로 남습니다.
          </p>
          <div class="space-y-1">
            <Label for="dormant-month">휴면 시작월</Label>
            <Input id="dormant-month" v-model="dormantMonth" placeholder="YYYY-MM" />
          </div>
          <p v-if="dormantError" class="text-xs text-destructive">{{ dormantError }}</p>

          <div class="flex justify-end gap-2 pt-1">
            <Button variant="outline" :disabled="dormantSaving" @click="dormantOpen = false">취소</Button>
            <Button :disabled="dormantSaving" @click="submitDormant()">
              {{ dormantSaving ? '저장하는 중…' : '휴면 처리' }}
            </Button>
          </div>
        </div>
      </Dialog>

      <!-- 삭제 -->
      <Dialog v-model:open="deleteOpen" label="회원 삭제" content-class="sm:max-w-sm">
        <div class="px-1 pt-1 space-y-3">
          <h2 class="text-base font-bold">회원 삭제</h2>
          <p class="text-sm">
            <span class="font-medium">{{ deleteRow?.name }}</span> 회원을 명단에서
            완전히 지웁니다. 로그인 정보와 접속 기록도 함께 사라지며 되돌릴 수 없습니다.
          </p>
          <p class="text-xs text-muted-foreground">
            경기 기록이 있는 회원은 서버가 삭제를 거절합니다. 그런 경우에는 휴면 처리를 쓰세요.
          </p>
          <p v-if="deleteError" class="text-xs text-destructive">{{ deleteError }}</p>

          <div class="flex justify-end gap-2 pt-1">
            <Button variant="outline" :disabled="deleteSaving" @click="deleteOpen = false">취소</Button>
            <Button variant="destructive" :disabled="deleteSaving" @click="submitDelete()">
              {{ deleteSaving ? '삭제하는 중…' : '삭제' }}
            </Button>
          </div>
        </div>
      </Dialog>

      <RowDetailDialog
        v-model:open="detailOpen"
        :title="detailRow ? detailRow.name : ''"
        :subtitle="detailRow ? (detailRow.role === 'admin' ? '관리자' : '회원') : ''"
      >
        <template v-if="detailRow">
          <DetailItem label="상태">{{ statusLabel(detailRow) }}</DetailItem>
          <DetailItem label="가입연도">
            <span class="font-mono">{{ detailRow.enrollment_year ?? DASH }}</span>
          </DetailItem>
          <DetailItem label="경기 기록">
            <span class="font-mono">{{ detailRow.result_count }}건</span>
          </DetailItem>
          <DetailItem label="기획 이력">
            <span class="font-mono">{{ detailRow.hosted_count }}회</span>
          </DetailItem>
          <DetailItem label="마지막 로그인">
            <span class="font-mono">{{ formatLastLogin(detailRow.last_login_at) }}</span>
          </DetailItem>
        </template>
      </RowDetailDialog>
    </div>
  </div>
</template>
