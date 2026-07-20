const getBusinessDate = (timestamp) => {
  const d = timestamp ? new Date(timestamp) : new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Africa/Lagos', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
  });
  return formatter.format(d);
};

const todayStr = getBusinessDate();

const getPastBusinessDateStr = (daysAgo) => {
    if (daysAgo === 0) return todayStr;
    const d = new Date();
    d.setDate(d.getDate() - daysAgo); // This modifies local date, which shifts UTC by exactly 24h * daysAgo (most of the time)
    return getBusinessDate(d);
};

console.log("Today:", todayStr);
console.log("Yesterday:", getPastBusinessDateStr(1));
