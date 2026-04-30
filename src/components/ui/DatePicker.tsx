import React from 'react';
import { format, parseISO } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface DatePickerProps {
  date?: string;
  setDate: (date: string) => void;
  label?: string;
  className?: string;
}

export const DatePicker = ({ date, setDate, label, className }: DatePickerProps) => {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full justify-start text-left font-bold border-border bg-background h-9 text-xs px-3",
          !date && "text-muted-foreground font-normal",
          className
        )}
      >
        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
        {date ? format(parseISO(date), "dd/MM/yyyy") : (label || "Seleccionar fecha")}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-card border-border shadow-2xl" align="start">
        <CalendarComponent
          mode="single"
          selected={date ? parseISO(date) : undefined}
          onSelect={(selectedDate) => {
            if (selectedDate) {
              setDate(format(selectedDate, "yyyy-MM-dd"));
            }
          }}
          initialFocus
          locale={es}
          className="bg-card text-foreground"
        />
      </PopoverContent>
    </Popover>
  );
};
