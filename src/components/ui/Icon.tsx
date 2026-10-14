import React from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Search,
  X,
  ArrowUpRight,
  ArrowRight,
  ArrowDown,
  Users,
  Copy,
  Bookmark,
  Share2,
  Image as ImageIcon,
  Camera,
  Settings,
  Plus,
  Library,
  Menu,
  Sliders,
  Sparkles,
  Pencil,
  Trash2,
  ExternalLink,
  Shield,
  Heart,
  MessageSquare,
  Info,
  AlertCircle,
  CheckCircle2,
  Sun,
  Moon,
  FileText,
  Command,
  HelpCircle,
  Send,
  Upload,
  User,
  LogOut,
  Key,
  Folder,
  Globe,
  Zap,
  Shuffle,
  RotateCw,
} from "lucide-react";

export const ICONS = {
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-up": ChevronUp,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  eye: Eye,
  "eye-off": EyeOff,
  search: Search,
  x: X,
  "arrow-up-right": ArrowUpRight,
  "arrow-right": ArrowRight,
  "arrow-down": ArrowDown,
  users: Users,
  copy: Copy,
  bookmark: Bookmark,
  share: Share2,
  image: ImageIcon,
  camera: Camera,
  settings: Settings,
  plus: Plus,
  library: Library,
  menu: Menu,
  sliders: Sliders,
  sparkles: Sparkles,
  pencil: Pencil,
  trash: Trash2,
  "external-link": ExternalLink,
  shield: Shield,
  heart: Heart,
  message: MessageSquare,
  info: Info,
  alert: AlertCircle,
  "check-circle": CheckCircle2,
  sun: Sun,
  moon: Moon,
  file: FileText,
  command: Command,
  help: HelpCircle,
  send: Send,
  upload: Upload,
  user: User,
  logout: LogOut,
  key: Key,
  folder: Folder,
  globe: Globe,
  zap: Zap,
  shuffle: Shuffle,
  refresh: RotateCw,
} as const;

export type IconName = keyof typeof ICONS;

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 18, className, ...rest }: IconProps) {
  const Component = ICONS[name];
  if (!Component) {
    return null;
  }
  return (
    <Component
      width={size}
      height={size}
      strokeWidth={1.75}
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    />
  );
}
