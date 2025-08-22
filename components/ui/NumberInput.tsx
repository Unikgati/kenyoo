import React from 'react';
import { cn } from '../../lib/utils';
import Input from './Input';

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

const NumberInput: React.FC<NumberInputProps> = ({ value, onChange, className, ...props }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numberValue = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
    onChange(numberValue);
  };

  return (
    <Input
      {...props}
      type="number"
      value={value}
      onChange={handleChange}
      min={0}
      step={1}
      className={cn("text-right", className)}
    />
  );
};

export default NumberInput;
