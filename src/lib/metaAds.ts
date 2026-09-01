/**
 * Meta Ads Marketing API Client & Synchronization Engine
 * Handles robust date range splitting, daily increments, and client/server hybrid fallback.
 */

export interface MetaWeekResult {
  formSpend: number;
  formLeads: number;
  wppSpend: number;
  wppLeads: number;
  totalSpend: number;
  isFuture: boolean;
  daysCount: number;
}

export interface MetaSyncResponse {
  success: boolean;
  cleanAccountId: string;
  period: { since: string; until: string };
  totalSpend: number;
  totalLeads: number;
  weeks: {
    week1: MetaWeekResult;
    week2: MetaWeekResult;
    week3: MetaWeekResult;
    week4: MetaWeekResult;
  };
}

export async function fetchMetaAdsInsights(
  accountId: string,
  accessToken: string,
  year: number,
  month: number
): Promise<MetaSyncResponse> {
  const cleanAccountId = accountId.trim().startsWith('act_') ? accountId.trim() : `act_${accountId.trim()}`;
  const token = accessToken.trim();

  const pad = (n: number) => String(n).padStart(2, '0');
  const m = pad(month);
  const daysInMonth = new Date(year, month, 0).getDate();

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const monthStart = `${year}-${m}-01`;
  const monthEnd = `${year}-${m}-${pad(daysInMonth)}`;

  const weekRanges = {
    week1: { startDay: 1, endDay: 7, startStr: `${year}-${m}-01`, endStr: `${year}-${m}-07` },
    week2: { startDay: 8, endDay: 14, startStr: `${year}-${m}-08`, endStr: `${year}-${m}-14` },
    week3: { startDay: 15, endDay: 21, startStr: `${year}-${m}-15`, endStr: `${year}-${m}-21` },
    week4: { startDay: 22, endDay: daysInMonth, startStr: `${year}-${m}-22`, endStr: `${year}-${m}-${pad(daysInMonth)}` },
  };

  // If entire month is in the future
  if (monthStart > todayStr) {
    return {
      success: true,
      cleanAccountId,
      period: { since: monthStart, until: monthEnd },
      totalSpend: 0,
      totalLeads: 0,
      weeks: {
        week1: { formSpend: 0, formLeads: 0, wppSpend: 0, wppLeads: 0, totalSpend: 0, isFuture: true, daysCount: 0 },
        week2: { formSpend: 0, formLeads: 0, wppSpend: 0, wppLeads: 0, totalSpend: 0, isFuture: true, daysCount: 0 },
        week3: { formSpend: 0, formLeads: 0, wppSpend: 0, wppLeads: 0, totalSpend: 0, isFuture: true, daysCount: 0 },
        week4: { formSpend: 0, formLeads: 0, wppSpend: 0, wppLeads: 0, totalSpend: 0, isFuture: true, daysCount: 0 },
      },
    };
  }

  // 1. First attempt: call local/server backend route /api/meta/insights
  try {
    const serverRes = await fetch('/api/meta/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: cleanAccountId, accessToken: token, year, month }),
    });

    const contentType = serverRes.headers.get('content-type') || '';
    if (serverRes.ok && contentType.includes('application/json')) {
      const serverData = await serverRes.json();
      if (serverData && serverData.weeks) {
        return serverData;
      }
    }
  } catch (err) {
    console.warn('Backend proxy /api/meta/insights not available or returned non-JSON, falling back to direct Meta Graph API:', err);
  }

  // 2. Fallback / Direct Browser Call to Meta Marketing API
  const effectiveUntil = monthEnd > todayStr ? todayStr : monthEnd;

  const campaignUrl = `https://graph.facebook.com/v19.0/${cleanAccountId}/insights?time_range={"since":"${monthStart}","until":"${effectiveUntil}"}&time_increment=1&level=campaign&fields=campaign_id,campaign_name,objective,spend,actions,cost_per_action_type&limit=1000&access_token=${encodeURIComponent(token)}`;
  const accountUrl = `https://graph.facebook.com/v19.0/${cleanAccountId}/insights?time_range={"since":"${monthStart}","until":"${effectiveUntil}"}&time_increment=1&fields=spend,actions,cost_per_action_type&limit=1000&access_token=${encodeURIComponent(token)}`;

  const [campaignRes, accountRes] = await Promise.all([
    fetch(campaignUrl).catch(() => null),
    fetch(accountUrl).catch(() => null),
  ]);

  let campaignData: any = null;
  let accountData: any = null;

  if (campaignRes) {
    try { campaignData = await campaignRes.json(); } catch {}
  }
  if (accountRes) {
    try { accountData = await accountRes.json(); } catch {}
  }

  if ((!campaignData || campaignData.error) && (!accountData || accountData.error)) {
    const errorMsg = campaignData?.error?.message || accountData?.error?.message || 'Error de autenticación o cuenta publicitaria no encontrada en Meta Ads';
    throw new Error(errorMsg);
  }

  const weeksResult: Record<string, {
    formSpend: number;
    formLeads: number;
    wppSpend: number;
    wppLeads: number;
    totalSpend: number;
    isFuture: boolean;
    daysProcessed: Set<string>;
  }> = {
    week1: { formSpend: 0, formLeads: 0, wppSpend: 0, wppLeads: 0, totalSpend: 0, isFuture: weekRanges.week1.startStr > todayStr, daysProcessed: new Set() },
    week2: { formSpend: 0, formLeads: 0, wppSpend: 0, wppLeads: 0, totalSpend: 0, isFuture: weekRanges.week2.startStr > todayStr, daysProcessed: new Set() },
    week3: { formSpend: 0, formLeads: 0, wppSpend: 0, wppLeads: 0, totalSpend: 0, isFuture: weekRanges.week3.startStr > todayStr, daysProcessed: new Set() },
    week4: { formSpend: 0, formLeads: 0, wppSpend: 0, wppLeads: 0, totalSpend: 0, isFuture: weekRanges.week4.startStr > todayStr, daysProcessed: new Set() },
  };

  const getWeekKeyForDay = (day: number) => {
    if (day >= 1 && day <= 7) return 'week1';
    if (day >= 8 && day <= 14) return 'week2';
    if (day >= 15 && day <= 21) return 'week3';
    return 'week4';
  };

  const campaignItems: any[] = Array.isArray(campaignData?.data) ? campaignData.data : [];
  const accountItems: any[] = Array.isArray(accountData?.data) ? accountData.data : [];

  if (campaignItems.length > 0) {
    for (const item of campaignItems) {
      const dateStr = item.date_start;
      if (!dateStr || dateStr > todayStr) continue;

      const dayNum = parseInt(dateStr.split('-')[2], 10);
      const weekKey = getWeekKeyForDay(dayNum);
      const week = weeksResult[weekKey];
      if (week.isFuture) continue;

      const spend = parseFloat(item.spend || '0') || 0;
      const campaignName = (item.campaign_name || '').toLowerCase();
      const objective = (item.objective || '').toUpperCase();

      const isWpp = campaignName.includes('wpp') || 
                    campaignName.includes('whatsapp') || 
                    campaignName.includes('msg') || 
                    campaignName.includes('mensaj') ||
                    campaignName.includes('chat') ||
                    objective === 'OUTCOME_ENGAGEMENT' ||
                    objective === 'MESSAGES';

      let formLeads = 0;
      let wppLeads = 0;

      if (Array.isArray(item.actions)) {
        for (const act of item.actions) {
          const type = act.action_type || '';
          const val = parseInt(act.value || '0', 10) || 0;

          if (type === 'lead' || type === 'onsite_conversion.lead_grouped' || type === 'leadgen_grouped' || type === 'offsite_conversion.fb_pixel_lead' || type === 'contact') {
            if (type === 'lead' || (type === 'onsite_conversion.lead_grouped' && formLeads === 0)) {
              formLeads += val;
            }
          } else if (type.includes('messaging') || type === 'onsite_conversion.messaging_conversation_started_7d' || type === 'onsite_conversion.total_messaging_connection' || type.includes('whatsapp') || type === 'messages') {
            if (type === 'onsite_conversion.messaging_conversation_started_7d' || (type.includes('messaging') && wppLeads === 0)) {
              wppLeads += val;
            }
          }
        }
      }

      if (isWpp) {
        week.wppSpend += spend;
        week.wppLeads += (wppLeads || formLeads);
      } else {
        week.formSpend += spend;
        week.formLeads += (formLeads || (wppLeads && !isWpp ? wppLeads : 0));
      }

      week.totalSpend += spend;
      week.daysProcessed.add(dateStr);
    }
  } else if (accountItems.length > 0) {
    for (const item of accountItems) {
      const dateStr = item.date_start;
      if (!dateStr || dateStr > todayStr) continue;

      const dayNum = parseInt(dateStr.split('-')[2], 10);
      const weekKey = getWeekKeyForDay(dayNum);
      const week = weeksResult[weekKey];
      if (week.isFuture) continue;

      const spend = parseFloat(item.spend || '0') || 0;
      let formLeads = 0;
      let wppLeads = 0;

      if (Array.isArray(item.actions)) {
        for (const act of item.actions) {
          const type = act.action_type || '';
          const val = parseInt(act.value || '0', 10) || 0;

          if (type === 'lead' || type === 'onsite_conversion.lead_grouped' || type === 'leadgen_grouped') {
            formLeads = Math.max(formLeads, val);
          } else if (type.includes('messaging') || type === 'onsite_conversion.messaging_conversation_started_7d') {
            wppLeads = Math.max(wppLeads, val);
          }
        }
      }

      if (wppLeads > 0 && formLeads === 0) {
        week.wppSpend += spend;
        week.wppLeads += wppLeads;
      } else {
        week.formSpend += spend;
        week.formLeads += formLeads;
        week.wppLeads += wppLeads;
      }

      week.totalSpend += spend;
      week.daysProcessed.add(dateStr);
    }
  }

  const cleanWeeks: any = {};
  let grandTotalSpend = 0;
  let grandTotalLeads = 0;

  for (const [key, w] of Object.entries(weeksResult)) {
    const roundedFormSpend = Math.round(w.formSpend * 100) / 100;
    const roundedWppSpend = Math.round(w.wppSpend * 100) / 100;
    cleanWeeks[key] = {
      formSpend: w.isFuture ? 0 : roundedFormSpend,
      formLeads: w.isFuture ? 0 : w.formLeads,
      wppSpend: w.isFuture ? 0 : roundedWppSpend,
      wppLeads: w.isFuture ? 0 : w.wppLeads,
      isFuture: w.isFuture,
      totalSpend: w.isFuture ? 0 : Math.round((roundedFormSpend + roundedWppSpend) * 100) / 100,
      daysCount: w.daysProcessed.size,
    };
    if (!w.isFuture) {
      grandTotalSpend += cleanWeeks[key].totalSpend;
      grandTotalLeads += (cleanWeeks[key].formLeads + cleanWeeks[key].wppLeads);
    }
  }

  return {
    success: true,
    cleanAccountId,
    period: { since: monthStart, until: effectiveUntil },
    totalSpend: Math.round(grandTotalSpend * 100) / 100,
    totalLeads: grandTotalLeads,
    weeks: cleanWeeks,
  };
}
