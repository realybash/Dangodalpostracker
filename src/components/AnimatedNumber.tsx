import { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';

interface AnimatedNumberProps {
  value: number;
  format?: (value: number) => string;
}

export function AnimatedNumber({ value, format }: AnimatedNumberProps) {
  const spring = useSpring(value, { mass: 0.8, stiffness: 75, damping: 15 });
  const display = useTransform(spring, (latest) =>
    format ? format(latest) : Math.round(latest).toString()
  );

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span>{display}</motion.span>;
}
