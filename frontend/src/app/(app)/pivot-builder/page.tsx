import { TaskWorkspace } from '@/components/task-workspace';

export default function PivotBuilderPage() {
  return (
    <TaskWorkspace
      title="Pivot Builder"
      badge="Core workflow"
      subtitle="Mirror the competitor’s headline promise: describe the view you want, then generate a pivot-ready configuration over the selected workbook."
      endpoint="/api/pivot-builder"
      resultHeading="Pivot recommendation"
      promptPlaceholder="Build a pivot that compares revenue by region and month, with a total revenue sum and a product filter."
      extraFields={[
        {
          key: 'sheetName',
          label: 'Preferred sheet name',
          type: 'textarea',
          defaultValue: '',
          placeholder: 'Optional: force a specific sheet if the workbook has many tabs.',
        },
      ]}
    />
  );
}
