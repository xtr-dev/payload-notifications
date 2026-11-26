# Changelog

## [0.2.0](https://github.com/xtr-dev/payload-notifications/compare/v0.1.0...v0.2.0) - 2026-11-26

### Breaking
- **push:** link default pushes to a configurable URL and stop referencing icons the package doesn't ship ([#41](https://github.com/xtr-dev/payload-notifications/issues/41)) ([f116ef2](https://github.com/xtr-dev/payload-notifications/commit/f116ef26bc3a50bd245a53c5ae26b0b7fe0409f3))
- **access:** store an explicit audience, scope read/create access, and track broadcast reads per user ([#40](https://github.com/xtr-dev/payload-notifications/issues/40)) ([ed1a13c](https://github.com/xtr-dev/payload-notifications/commit/ed1a13c165ef9b2920c67f45a50c32d76329fe07))

### Fixes
- **push:** extract text from Lexical rich text for the default push body ([#42](https://github.com/xtr-dev/payload-notifications/issues/42)) ([936ec9b](https://github.com/xtr-dev/payload-notifications/commit/936ec9bbf3a007f1acd2f36661066f6fddbf8dc0))

## [0.1.0] - 2026-11-25

### Breaking
- **access:** scope notification update access and limit non-admins to read flags ([#11](https://github.com/xtr-dev/payload-notifications/issues/11)) ([0f77c56](https://github.com/xtr-dev/payload-notifications/commit/0f77c563d1ee557cfb3eac0e082a04eb2d1b6c6f))

### Fixes
- **push:** register the /track endpoint and stop documenting /send and /test ([#17](https://github.com/xtr-dev/payload-notifications/issues/17)) ([324151c](https://github.com/xtr-dev/payload-notifications/commit/324151c37ab7cf45ca9c194b9ae75a23e7dea061))
- make push-subscriptions admin-only while web push is disabled ([daed0e9](https://github.com/xtr-dev/payload-notifications/commit/daed0e90ba8135139b748d4f9c93c4d42a818eb5))
- ship a classic plain-JS service worker with configurable icon/badge ([31dd1e0](https://github.com/xtr-dev/payload-notifications/commit/31dd1e0bde1dc1697ff975f09e9b35653c0e9d18))
- always register the push-subscriptions collection ([6b2a869](https://github.com/xtr-dev/payload-notifications/commit/6b2a869d5783f143593477968620ecfbabf9b644))
- reject subscribe when the endpoint belongs to another user ([2e5c642](https://github.com/xtr-dev/payload-notifications/commit/2e5c6428a1fd2536c10c14a76224efc6b03dec72))
- bind push-subscription user to requester; bump to 0.0.6 ([43afe11](https://github.com/xtr-dev/payload-notifications/commit/43afe11781fd3660f27a33934db026f511da5fc4))
- scope push-subscriptions read/update/delete access to owner ([7479377](https://github.com/xtr-dev/payload-notifications/commit/7479377e2319f99fa56a8bca04b6f55b15d96c5d))
- add NodeNext consumer type-check, fix root-entry extensionless imports ([90d0fbe](https://github.com/xtr-dev/payload-notifications/commit/90d0fbe68e5fa718831db6fa23e5dcd4de1d12b1))
- wire published-exports/unit tests into CI, fix type-only import extensions ([3ff443d](https://github.com/xtr-dev/payload-notifications/commit/3ff443d47426a0e03dfeae876819c1e95970c00e))
- make rsc export ESM-compatible ([8bda484](https://github.com/xtr-dev/payload-notifications/commit/8bda48489dad03eb974cae12601fd7bc9a382347))
- make client hook ESM-compatible ([160e4ea](https://github.com/xtr-dev/payload-notifications/commit/160e4eac8be69d060bbfcf06bbacde2083503588))
- emit browser-valid service worker code ([f3462e9](https://github.com/xtr-dev/payload-notifications/commit/f3462e97e7e8644af9a12ad915b4581f22fefa5d))

### Other
- release through the shared workflow with xtr-dev/changelog ([#39](https://github.com/xtr-dev/payload-notifications/issues/39)) ([8aacdea](https://github.com/xtr-dev/payload-notifications/commit/8aacdea7df9dafb45594ad984026cbba1f45e8e4))
- verify dist/sw.js is a classic worker in test:published-exports ([f348cd7](https://github.com/xtr-dev/payload-notifications/commit/f348cd736832988100f58bf8062b0abfa845b9b6))
- run tests and build on every push to main, not only on a release ([f722ecf](https://github.com/xtr-dev/payload-notifications/commit/f722ecf03ba81413df438a2f2c1d3b57a3b2264c))
- check the version only when a PR releases ([cd5487b](https://github.com/xtr-dev/payload-notifications/commit/cd5487bbd8d7eac3f809d7327ad3841ba394b199))
- Fix CLAUDE.md build process claim to match ESM-only build ([8def46f](https://github.com/xtr-dev/payload-notifications/commit/8def46fde60e43a27eac550980987338af0c96cb))
- cover unsubscribe endpoint's auth/ownership behavior ([da55edf](https://github.com/xtr-dev/payload-notifications/commit/da55edf5524ae6325f5fa9b04afb9a85a6fec6fb))
- add contract test for serviceWorkerCode classic-script shape ([fea3557](https://github.com/xtr-dev/payload-notifications/commit/fea35574f5836494e6d807e5e3f9620527eb5c8e))
- fix unrunnable WEBPUSH/README samples flagged in review ([8dc1d38](https://github.com/xtr-dev/payload-notifications/commit/8dc1d380222583ea68dca951a279d48e17de723f))
- fix basic plugin usage example ([d04090d](https://github.com/xtr-dev/payload-notifications/commit/d04090d2255f3dad9d723cfc80ac006dce609783))
- fix stale attachments/relationship claims in README, WEBPUSH, dev docs ([7b683c8](https://github.com/xtr-dev/payload-notifications/commit/7b683c8abc87b42e793fee5f4419483306304fb3))
- fix remaining stale relationship-system claims in CLAUDE.md ([36f1828](https://github.com/xtr-dev/payload-notifications/commit/36f1828231b77c8cf1ebb3f45f9cc7a7d417fb93))
- update plugin architecture guide ([d5837e6](https://github.com/xtr-dev/payload-notifications/commit/d5837e68aa3115cfc615b1aafc636991beeecf0f))
