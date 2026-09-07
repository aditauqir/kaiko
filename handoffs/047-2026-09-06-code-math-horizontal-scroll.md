# 047: Code & Math Block Horizontal Containment and Independent Scrolling

## Summary
Constrained code blocks and math blocks to match the horizontal viewport width of the Kaiako sidebar, ensuring that only overflowing code or math equations scroll horizontally without expanding or scrolling the entire message turn or chat history container.

## Changes Made
1. **Flex & Overflow Containment (`kaiako/styles.css`)**:
   - `.kaiako-chat`: added `min-width: 0`, `width: 100%`, `box-sizing: border-box`, and `overflow: hidden` to anchor the horizontal boundary of the sidebar view.
   - `.kaiako-messages`: updated to `overflow-y: auto`, `overflow-x: hidden`, `min-width: 0`, `width: 100%`, and `box-sizing: border-box`, guaranteeing that the message scroll container cannot scroll horizontally.
   - `.kaiako-turn`, `.kaiako-bubble`, `.kaiako-turn--user`: added `min-width: 0`, `box-sizing: border-box`, and width constraints so that flex children do not expand beyond the sidebar viewport when containing preformatted or wide mathematical content.
   - `.kaiako-root .kaiako-md`, `.kaiako-md`: added `min-width: 0`, `max-width: 100%`, `width: 100%`, and `overflow-wrap: break-word`.
   - Added `max-width: 100%` and `overflow-x: auto` protections for markdown `img` and `table` elements.

2. **Code Blocks (`kaiako/styles.css`)**:
   - Targeted `.kaiako-md pre`, `.kaiako-bubble pre`, `.kaiako-mcq pre`:
     - `position: relative`
     - `box-sizing: border-box !important`
     - `max-width: 100% !important; width: 100% !important; min-width: 0 !important`
     - `overflow-x: auto !important; overflow-y: hidden !important`
     - `overscroll-behavior-x: contain`
     - `white-space: pre !important; word-break: normal !important; word-wrap: normal !important`
     - Sleek custom scrollbar styling (`6px` height, rounded subtle thumb) for both light and dark mode.
   - Targeted `.kaiako-md pre > code`, `.kaiako-bubble pre > code`, `.kaiako-mcq pre > code`:
     - `display: block !important; width: max-content !important; min-width: 100% !important`
     - Allows pre to calculate accurate horizontal scroll width while preserving exact preformatted formatting.
   - Preserved soft wrapping for inline code (`:not(pre) > code`).

3. **Math Blocks (`kaiako/styles.css`)**:
   - Targeted display math containers (`.math-block`, `div.math`, `.MathJax_Display`, `.katex-display`, `mjx-container[display="true"]`):
     - `display: block !important; max-width: 100% !important; width: 100% !important; min-width: 0 !important`
     - `box-sizing: border-box !important`
     - `overflow-x: auto !important; overflow-y: hidden !important`
     - `overscroll-behavior-x: contain`
     - `text-align: center` with slim scrollbar styling.
   - Handled nested MathJax / KaTeX display structures (`.math-block > mjx-container[display="true"]`, `.math-block > .katex-display`) by delegating scrolling cleanly to the outer `.math-block` with `overflow-x: visible; width: auto; max-width: none; min-width: min-content; display: inline-block;`, preventing duplicate scrollbars.
   - Added dark theme scrollbar and background styles under `.kaiako-shell.kaiako-locked`.

## Verification
- Built with `npm run build` (`tsc --noEmit --skipLibCheck && node esbuild.config.mjs production`) with 0 errors.
- Verified `git diff --check` passed cleanly with 0 whitespace errors.
- Confirmed that long code lines and wide math equations fit within the sidebar viewport and scroll horizontally independently without causing the sidebar or messages pane to scroll horizontally.
