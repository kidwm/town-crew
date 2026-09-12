> Historical Bevy reference, archived at `bevy-prototype`. For current development, use the root README and PROJECT_PLAN.md.

# Town Crew

A small browser-based vehicle mission game for young children, built with Rust, Bevy, and WebAssembly.

The first mission follows a construction crew as they repair a pothole using an excavator, dump truck, and road roller.

## Development

Run the native app with Bevy dynamic linking for faster iterative compiles:

```sh
cargo run --features bevy/dynamic_linking
```

The first build still compiles the dynamic Bevy library. Use this command only
for native development; WebAssembly and release builds remain statically linked.

Run the browser build:

```sh
trunk serve --open
```

Check formatting and linting:

```sh
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
```
