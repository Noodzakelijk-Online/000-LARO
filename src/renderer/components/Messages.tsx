import DashboardLayout from "@/components/DashboardLayout";
import CommunicationHub from "@/components/CommunicationHub";

export default function Messages() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent sm:text-4xl">
            Case Notes
          </h1>
          <p className="mt-2 text-base text-muted-foreground sm:text-lg">
            Review and write notes stored in your LARO case records
          </p>
        </div>
        
        <CommunicationHub />
      </div>
    </DashboardLayout>
  );
}

