import { TaskWorkspace } from '@/components/task-workspace';

export default function DataAnalysisPage() {
  return (
    <TaskWorkspace
      title="Data Analysis"
      badge="Core workflow"
      subtitle="Turn uploaded workbooks into trends, anomalies, and insight cards that users can reuse in the assistant or reports flow."
      endpoint="/api/data-analysis"
      resultHeading="Analysis result"
      promptPlaceholder="Find seasonal trends, regional outliers, and the strongest product-level growth signals in this workbook."
      extraFields={[
        {
          key: 'complexity',
          label: 'Reasoning mode',
          type: 'select',
          defaultValue: 'normal',
          options: [
            { label: 'Normal', value: 'normal' },
            { label: 'Complex', value: 'complex' },
          ],
        },
      ]}
    />
  );
}
