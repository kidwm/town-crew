# Town Crew

A small browser-based vehicle mission game for young children, built with Rust, Bevy, and WebAssembly.

The first mission follows a construction crew as they repair a pothole using an excavator, dump truck, and road roller.

## Development

Run the native app:

```sh
cargo run
```

Run the browser build:

```sh
trunk serve --open
```

Check formatting and linting:

```sh
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
```
