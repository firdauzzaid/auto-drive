const databaseUrl = process.env.TEST_DATABASE_URL;

if (databaseUrl) {
  const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");
  if (!databaseName.endsWith("_test")) {
    throw new Error("TEST_DATABASE_URL must target a database whose name ends with _test");
  }
}

export { databaseUrl };
