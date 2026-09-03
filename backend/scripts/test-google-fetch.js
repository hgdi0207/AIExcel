fetch('https://www.googleapis.com/oauth2/v3/userinfo')
  .then(async (response) => {
    console.log(`status=${response.status}`);
    const body = await response.text();
    console.log(body.slice(0, 200));
  })
  .catch((error) => {
    console.error(`ERR=${error instanceof Error ? error.message : String(error)}`);
    const cause =
      error && typeof error === 'object' && 'cause' in error
        ? error.cause
        : undefined;
    if (cause instanceof Error) {
      console.error(`CAUSE=${cause.name}:${cause.message}`);
    } else if (cause) {
      console.error(`CAUSE=${String(cause)}`);
    }
    process.exit(1);
  });
