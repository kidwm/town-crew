// Backward-compatible authoring command; CI never calls a generation client.
process.argv.splice(2, 0, 'fire-rescue');
await import('./generate-voice.mjs');
