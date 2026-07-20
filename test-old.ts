function getLagosNow(): Date {
  const now = new Date(); // local time (PDT)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const partValues: Record<string, number> = {};
  parts.forEach(p => {
    if (p.type !== 'literal') partValues[p.type] = parseInt(p.value, 10);
  });
  
  return new Date(partValues.year, partValues.month - 1, partValues.day, partValues.hour, partValues.minute, partValues.second);
}

function getBusinessDateOld(timestamp?: any): string {
  let d: Date;
  
  if (!timestamp) {
    const lagosNow = getLagosNow();
    return `${lagosNow.getFullYear()}-${String(lagosNow.getMonth() + 1).padStart(2, '0')}-${String(lagosNow.getDate()).padStart(2, '0')}`;
  } else if (timestamp && (timestamp as any).toDate && typeof (timestamp as any).toDate === 'function') {
    d = (timestamp as any).toDate();
  } else {
    d = new Date(timestamp);
  }
  
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Africa/Lagos', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
    return formatter.format(d);
  } catch (e) {
    return d.toISOString().split('T')[0];
  }
}

// Suppose a transaction was created today at 13:00 UTC (06:00 PDT, 14:00 Lagos).
const creationTime = new Date("2026-07-19T13:00:00Z");

console.log("OLD format of creation time:", getBusinessDateOld(creationTime));
