console.log(JSON.stringify({
  env: Object.keys(process.env).filter(k => k.includes('GOOGLE') || k.includes('FIREBASE') || k.includes('CREDENTIALS') || k.includes('KEY')),
  hasGac: !!process.env.GOOGLE_APPLICATION_CREDENTIALS
}, null, 2));
