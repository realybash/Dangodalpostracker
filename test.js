function getBusinessDate(timestamp) {
  let d = new Date();
  if (timestamp) {
    d = new Date(timestamp);
  }
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
console.log("Current:", getBusinessDate());
console.log("June 14 23:50 UTC (June 15 00:50 WAT):", getBusinessDate('2026-06-14T23:50:00Z'));
