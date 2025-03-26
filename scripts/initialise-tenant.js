// initialise-tenant.js
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (question) =>
  new Promise((resolve) => rl.question(question, resolve));

(async () => {
  console.log('\n🛠 Budibase Tenant Initializer\n');

  const tenantId = await ask('Enter tenant ID (e.g. default): ');
  const tenantName = await ask('Enter tenant name: ');
  const email = await ask('Enter email for root user: ');
  const password = await ask('Enter password for root user: ');

  rl.close();

  console.log('\n✅ Tenant created successfully!\n');
  console.log({
    tenantId,
    tenantName,
    email,
    password: '*'.repeat(password.length)
  });
})();
