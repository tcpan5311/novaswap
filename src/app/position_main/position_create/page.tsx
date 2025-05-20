import PositionCreate from "../../components/position_create"
import { BlockchainProvider } from "../../context/blockchain_context"

export default function Position() 
{
  return (
    <div>
      <PositionCreate></PositionCreate>
    </div>
  );
}