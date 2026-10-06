import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "quiet";
type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  variant?: Variant;
  children: ReactNode;
};

const classes: Record<Variant, string> = {
  primary: "primary-button",
  secondary: "secondary-button",
  quiet: "quiet-button",
};

export default function Button({
  variant = "secondary",
  className = "",
  children,
  type = "button",
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={`${classes[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
