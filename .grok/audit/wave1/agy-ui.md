# Audit Report: `src/components/ui` (`agy-ui.md`)

### HIGH
- **Dual Shim & Barrel Bypass (`app-toaster.tsx`)**:
  - `src/components/ui/app-toaster.tsx` exists as a flat shim re-exporting `Toaster as AppToaster` and `toast` from `src/components/ui/feedback/sonner.tsx`.
  - `src/components/ui/index.ts` exports `sonner.tsx` (`export * from "./feedback/sonner"`) but omits `app-toaster.tsx`.
  - Product components (`src/app/layout.tsx:5`, `src/components/chat/prompt/shell/prompt-input.tsx:56`) import directly from `@/components/ui/app-toaster` instead of `@/components/ui`, violating barrel encapsulation and creating dual naming conventions (`Toaster` vs `AppToaster`).

### MED
- **12 Dead UI Primitives (0 Imports)**:
  - The following 12 primitives in `src/components/ui/**` are unused across active product code outside `index.ts`:
    - `feedback/alert.tsx` (`Alert`, `AlertTitle`, `AlertDescription`)
    - `feedback/progress.tsx` (`Progress`)
    - `feedback/skeleton.tsx` (`Skeleton`)
    - `forms/switch.tsx` (`Switch`)
    - `layout/accordion.tsx` (`Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`)
    - `layout/avatar.tsx` (`Avatar`, `AvatarImage`, `AvatarFallback`, `AvatarBadge`)
    - `layout/badge.tsx` (`Badge`, `badgeVariants`)
    - `layout/card.tsx` (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `CardAction`)
    - `layout/scroll-area.tsx` (`ScrollArea`, `ScrollBar`)
    - `layout/separator.tsx` (`Separator`)
    - `navigation/tabs.tsx` (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`)
    - `overlays/sheet.tsx` (`Sheet`, `SheetTrigger`, `SheetContent`, etc.)
- **Dangling CSS Class Token (`cn-toast`)**:
  - `src/components/ui/feedback/sonner.tsx:53` references `toast: "cn-toast"`, but `.cn-toast` is defined nowhere in `src/app/globals.css` or the codebase.

### LOW
- **Token & Styling Issues**:
  - `src/components/ui/feedback/spinner.tsx:9`: Hardcoded inline color `text-[rgba(200,172,251,0.55)]` used instead of design token variable (`var(--lavender)` / `text-lavender/55`).
  - `src/components/ui/layout/badge.tsx:8`: Uses `rounded-2xl`, violating the `--radius: 0.55rem` restrained radius standard (`rounded-full`/`rounded-2xl` prohibited except on URL/source chips).
  - `src/components/ui/navigation/command.tsx:154`: Uses hardcoded inline CSS variable syntax `rounded-[var(--radius-md)]` and `bg-[var(--surface-hover)]` instead of standard Tailwind theme classes.
  - Double spaces in utility class strings in `actions/button.tsx:8`, `forms/select.tsx:47`, and `navigation/tabs.tsx:66`.
- **`any` Types**:
  - 0 instances of explicit/implicit `any` found in `src/components/ui/**`. Strict TypeScript typing maintained across all primitives.
