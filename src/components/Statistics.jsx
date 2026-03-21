import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { calculateStats } from '../lib/stats';
import { getTodayString } from '../lib/dates';

/** 최근 14일간의 날짜 배열을 생성한다 (오늘 포함, 오래된 순) */
function getLast14Days() {
  const days = [];
  const today = new Date(getTodayString() + 'T00:00:00Z');
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

/** 등급별 색상 매핑 */
const GRADE_COLORS = {
  again: 'bg-red-400',
  hard: 'bg-orange-400',
  good: 'bg-emerald-400',
  easy: 'bg-blue-400',
};

const GRADE_ORDER = ['again', 'hard', 'good', 'easy'];

export default function Statistics() {
  const reviewLogs = useLiveQuery(() => db.reviewLogs.toArray(), [], []);
  const stats = calculateStats(reviewLogs);

  // 학습 기록이 전혀 없는 경우
  if (reviewLogs.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">학습 통계</h1>
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-4">📊</p>
          <p className="text-lg mb-2">아직 학습 기록이 없습니다</p>
          <Link to="/review" className="text-indigo-600 font-medium">
            복습 시작하기 →
          </Link>
        </div>
      </div>
    );
  }

  const last14Days = getLast14Days();
  // 일별 통계를 Map으로 변환해서 빠르게 조회
  const statsMap = new Map(stats.dailyStats.map(d => [d.date, d]));
  // 14일간 최대 리뷰 수 (차트 높이 기준)
  const maxCount = Math.max(1, ...last14Days.map(d => statsMap.get(d)?.total ?? 0));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">학습 통계</h1>

      {/* 전체 통계 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-center">
          <p className="text-xs text-slate-500 mb-1">총 복습</p>
          <p className="text-2xl font-bold text-slate-800">{stats.totalReviews}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-center">
          <p className="text-xs text-slate-500 mb-1">정확도</p>
          <p className="text-2xl font-bold text-emerald-600">
            {Math.round(stats.overallAccuracy * 100)}%
          </p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-4 shadow-sm text-center text-white">
          <p className="text-xs text-orange-100 mb-1">연속 학습</p>
          <p className="text-2xl font-bold">
            {stats.streak}<span className="text-base ml-1">🔥</span>
          </p>
        </div>
      </div>

      {/* 최근 14일 바 차트 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <h2 className="text-sm font-medium text-slate-500 mb-4">최근 14일</h2>
        <div className="flex items-end gap-1" style={{ height: '160px' }}>
          {last14Days.map(date => {
            const day = statsMap.get(date);
            const total = day?.total ?? 0;
            // 막대 높이 비율 (최소 4px로 빈 날도 표시)
            const heightPct = total > 0 ? (total / maxCount) * 100 : 0;
            const dayOfMonth = parseInt(date.split('-')[2], 10);

            return (
              <div key={date} className="flex-1 flex flex-col items-center">
                {/* 스택 바 */}
                <div
                  className="w-full flex flex-col-reverse rounded-t overflow-hidden"
                  style={{ height: '140px' }}
                >
                  {total > 0 ? (
                    GRADE_ORDER.map(grade => {
                      const count = day[grade] ?? 0;
                      if (count === 0) return null;
                      const segmentPct = (count / total) * heightPct;
                      return (
                        <div
                          key={grade}
                          className={`${GRADE_COLORS[grade]} w-full`}
                          style={{ height: `${segmentPct}%` }}
                        />
                      );
                    })
                  ) : (
                    <div className="w-full bg-slate-100 rounded-t" style={{ height: '3px' }} />
                  )}
                </div>
                {/* 날짜 라벨 */}
                <span className="text-[10px] text-slate-400 mt-1">{dayOfMonth}</span>
              </div>
            );
          })}
        </div>

        {/* 범례 */}
        <div className="flex justify-center gap-3 mt-4 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />again</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" />hard</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />good</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" />easy</span>
        </div>
      </div>
    </div>
  );
}
