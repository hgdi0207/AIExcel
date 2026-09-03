import { TaskWorkspace } from '@/components/task-workspace';

export default function ReportsPage() {
  return (
    <TaskWorkspace
      title="Reports"
      badge="Core workflow"
      subtitle="Package workbook analysis into a report shell that can later export to Markdown, DOCX, and PDF once the backend export pipeline is completed."
      endpoint="/api/reports"
      resultHeading="Report preview"
      promptPlaceholder="Create a management-ready revenue summary with the top findings, a concise executive summary, and next-step recommendations."
      extraFields={[
        {
          key: 'format',
          label: 'Output format',
          type: 'select',
          defaultValue: 'md',
          options: [
            { label: 'Markdown', value: 'md' },
            { label: 'DOCX', value: 'docx' },
            { label: 'PDF', value: 'pdf' },
          ],
        },
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
