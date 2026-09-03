import { TaskWorkspace } from '@/components/task-workspace';

export default function ChartsPage() {
  return (
    <TaskWorkspace
      title="Charts & Graphs"
      badge="Core workflow"
      subtitle="Let the user state the story they want to tell, then generate a chart-ready configuration from the selected workbook."
      endpoint="/api/charts"
      resultHeading="Chart configuration"
      promptPlaceholder="Show the monthly revenue trend and make it easy to compare major product lines."
      extraFields={[
        {
          key: 'preferredChartType',
          label: 'Preferred chart type',
          type: 'select',
          defaultValue: 'line',
          options: [
            { label: 'Line', value: 'line' },
            { label: 'Bar', value: 'bar' },
            { label: 'Pie', value: 'pie' },
            { label: 'Scatter', value: 'scatter' },
          ],
        },
      ]}
    />
  );
}
