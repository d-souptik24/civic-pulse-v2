import { useState, useEffect } from 'react';

export function useTypewriter(
  text,
  speed = 38,
  startDelay = 800
) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    let interval;
    const delay = setTimeout(() => {
      interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
          setDone(true);
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(delay);
      if (interval) clearInterval(interval);
    };
  }, [text, speed, startDelay]);

  return { displayed, done };
}
