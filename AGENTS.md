# Cross-platform product rules

- Treat web, iOS, and Android as supported product targets.
- Keep user-visible features and controls functionally equivalent on all three targets.
- A `.web.tsx` implementation must have an iOS/Android implementation with the same product behavior; do not ship a text-only native fallback unless the user explicitly accepts it.
- Test shared behavior plus each platform-specific implementation changed by a task.
- Report any platform that could not be run manually; do not imply unverified runtime parity.
