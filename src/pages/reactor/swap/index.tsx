import ReactorLayout from "../layout";
import { ReactorSwap } from "@/lib/components/blockchain/swap/ReactorSwap";

export default function ReactorPage() {
  return (
<ReactorLayout>
      <div className='container mx-auto pb-8 space-y-4'>
        <div className="flex flex-col items-center justify-center">
          <ReactorSwap/>
        </div>
      </div>
</ReactorLayout>
  );
}
