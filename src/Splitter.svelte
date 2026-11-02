<script>
  // Vertical resize handle between the two panes. `ratio` is the width of the
  // left pane as a percentage of the parent element.
  let { ratio, min = 20, max = 80, defaultRatio = 40, label, onChange } = $props();

  const KEYBOARD_STEP = 2;

  let dragging = $state(false);

  function clamp(nextRatio) {
    return Math.round(Math.max(min, Math.min(max, nextRatio)) * 10) / 10;
  }

  function ratioFromPointer(event) {
    const bounds = event.currentTarget.parentElement.getBoundingClientRect();
    return ((event.clientX - bounds.left) / bounds.width) * 100;
  }

  function handlePointerDown(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging = true;
  }

  function handlePointerMove(event) {
    if (!dragging) return;
    onChange?.(clamp(ratioFromPointer(event)));
  }

  function handlePointerUp(event) {
    if (!dragging) return;
    dragging = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleKeydown(event) {
    const actions = {
      ArrowLeft: () => ratio - KEYBOARD_STEP,
      ArrowRight: () => ratio + KEYBOARD_STEP,
      Home: () => min,
      End: () => max,
    };
    const action = actions[event.key];
    if (!action) return;

    event.preventDefault();
    onChange?.(clamp(action()));
  }
</script>

<!-- A focusable role="separator" is an interactive widget per WAI-ARIA (window splitter pattern). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="splitter"
  class:is-dragging={dragging}
  role="separator"
  aria-orientation="vertical"
  aria-label={label}
  aria-valuenow={Math.round(ratio)}
  aria-valuemin={min}
  aria-valuemax={max}
  tabindex="0"
  title="Drag to resize, double-click to reset"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
  ondblclick={() => onChange?.(defaultRatio)}
  onkeydown={handleKeydown}
></div>

<style>
  .splitter {
    position: relative;
    flex: 0 0 12px;
    cursor: col-resize;
    touch-action: none;
    outline: none;
  }

  .splitter::after {
    content: "";
    position: absolute;
    inset: 0 auto 0 50%;
    width: 2px;
    transform: translateX(-50%);
    border-radius: 2px;
    background: transparent;
    transition: background-color 120ms ease;
  }

  .splitter:hover::after,
  .splitter.is-dragging::after {
    background: var(--border);
  }

  .splitter:focus-visible::after {
    width: 3px;
    background: var(--accent);
  }

  /* Panes are stacked on small screens */
  @media (max-width: 768px) {
    .splitter {
      display: none;
    }
  }
</style>
