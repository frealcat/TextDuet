# Third-Party Notices

TextDuet includes or is built with the following direct dependencies. The
release process also emits `THIRD_PARTY_LICENSES.json`, a machine-readable
report of every package in the locked dependency graph (including transitive
build dependencies), with its version, source archive and declared SPDX
license. Other transitive packages remain subject to the license metadata and
notices shipped by their respective packages.

| Dependency (version) | Copyright / attribution | License | Distributed in extension |
| --- | --- | --- | --- |
| React 19.2.8 and React DOM 19.2.8 | Copyright Meta Platforms, Inc. and affiliates | MIT | Yes |
| Zod 4.4.3 | Copyright Colin McDonnell | MIT | Yes |
| Radix UI Radio Group 1.4.7 | Copyright WorkOS | MIT | Yes |
| WXT 0.21.4 and WXT React module 1.2.2 | Copyright Aaron Klinker and WXT contributors | MIT | Build-time only |

The complete Apache-2.0 license text for TextDuet is included in the root
`LICENSE` file. Dependency source archives and their declared license IDs are
listed in `THIRD_PARTY_LICENSES.json`; this notice records the attribution for
the direct dependencies used by the extension.

The following development dependency is used only by deterministic browser
regression harnesses and is not bundled into the extension:

| Test dependency (version) | Copyright / attribution | License | Distributed in extension |
| --- | --- | --- | --- |
| Playwright 1.62.1 | Copyright Microsoft Corporation | Apache-2.0 | No (test-time only) |

## MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
