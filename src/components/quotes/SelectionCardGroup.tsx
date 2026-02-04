import { Sparkles, FileText, UploadCloud } from "lucide-react";
import { SelectionCard } from "./SelectionCard";

interface SelectionCardGroupProps {
  selectedMethod: string;
  onMethodChange: (method: string) => void;
}

export function SelectionCardGroup({ selectedMethod, onMethodChange }: SelectionCardGroupProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl">
      <SelectionCard
        icon={Sparkles}
        title="AI Assistant"
        description="Create a quote using natural language."
        isSelected={selectedMethod === 'ai'}
        isRecommended={true}
        onClick={() => onMethodChange('ai')}
      />
      
      <SelectionCard
        icon={FileText}
        title="Structured Form"
        description="Fill in the fields manually."
        isSelected={selectedMethod === 'form'}
        onClick={() => onMethodChange('form')}
      />
      
      <SelectionCard
        icon={UploadCloud}
        title="Import File"
        description="Upload a CSV or spreadsheet."
        isSelected={selectedMethod === 'import'}
        onClick={() => onMethodChange('import')}
      />
    </div>
  );
}