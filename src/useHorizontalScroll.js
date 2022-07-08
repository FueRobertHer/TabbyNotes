import { useRef } from 'react';


function useHorizontalScroll() {
    const ref = useRef(null);

    function scrollHorizontally(e) {
      const scrollPosition = ref.current.scrollLeft;
      if (e.deltaX === 0) {
        ref.current.scrollTo({
          top: 0,
          left: scrollPosition + e.deltaY,
        });
      }
    }

    return { ref, scrollHorizontally };
}

export default useHorizontalScroll;
