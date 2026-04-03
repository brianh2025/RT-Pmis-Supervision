import { useEffect } from 'react';

/**
 * 捲動時在目標元素加上 .scrolling class，
 * 停止捲動 1500ms 後自動移除（逾時隱藏卷軸）。
 * @param {React.RefObject} ref - 目標容器 ref（可為 null，則監聽 document）
 */
export function useAutoHideScrollbar(ref) {
  useEffect(() => {
    const el = ref?.current ?? null;
    const target = el || window;
    let timer = null;

    function onScroll() {
      const node = el || document.querySelectorAll('.custom-scrollbar');
      if (el) {
        el.classList.add('scrolling');
      } else {
        document.querySelectorAll('.custom-scrollbar').forEach(n => n.classList.add('scrolling'));
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (el) {
          el.classList.remove('scrolling');
        } else {
          document.querySelectorAll('.custom-scrollbar').forEach(n => n.classList.remove('scrolling'));
        }
      }, 1500);
    }

    target.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      target.removeEventListener('scroll', onScroll, { capture: true });
      clearTimeout(timer);
    };
  }, [ref]);
}
