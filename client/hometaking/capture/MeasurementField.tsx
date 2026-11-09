import React, { useEffect, useRef, useState } from "react";
import { Field } from "../ui";

// Keep intermediate decimal input such as "12." visible while the numeric model
// updates. Replacing it immediately with "12" makes decimal measurements untypeable.
export function MeasurementField({
  value = "",
  onChangeText,
  ...props
}: React.ComponentProps<typeof Field>) {
  const [text, setText] = useState(value);
  const expected = useRef(value);
  useEffect(() => {
    if (value !== expected.current) {
      expected.current = value;
      setText(value);
    }
  }, [value]);
  return (
    <Field
      {...props}
      value={text}
      keyboardType="decimal-pad"
      onChangeText={(next) => {
        if (!/^-?\d*(?:[.,]\d*)?$/.test(next)) return;
        setText(next);
        const number = Number(next.replace(",", "."));
        if (Number.isFinite(number)) {
          expected.current = next === "" ? "" : String(number);
          onChangeText?.(next);
        }
      }}
      onBlur={() => setText(value)}
    />
  );
}
