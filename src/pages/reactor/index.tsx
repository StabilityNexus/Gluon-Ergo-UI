import { GluonStats } from "@/lib/components/blocks/dashboard/GluonStats";
import ReactorLayout from "./layout";
import { MyStats } from "@/lib/components/blocks/dashboard/MyStats";

export default function ReactorDashboard() {
  return (
<ReactorLayout>
      <div className='container mx-auto  pb-8 space-y-4'>
       <GluonStats />
       <MyStats />
      </div>
</ReactorLayout>
  );
}
