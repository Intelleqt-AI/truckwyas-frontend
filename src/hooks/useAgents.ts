import { AgentCardProps } from "@/components/agent/AgentCard";

// Mock agent data for different modules
export const useAgents = (module?: string): AgentCardProps[] => {
  const baseAgents: AgentCardProps[] = [
    {
      id: "agent-1",
      title: "Fuel Efficiency Opportunity",
      what: "Route JHB-CPT showing 15% higher fuel consumption than benchmark",
      impactZAR: 4200,
      confidence: 0.87,
      why: [
        "Vehicle TRK-003 consistently 18% above fleet average",
        "Driver S. Mthembu's route pattern differs from optimal",
        "Alternative route via N1 shows 12% fuel savings in simulation"
      ],
      actions: [
        {
          id: "action-1",
          label: "Optimize Route",
          type: "primary"
        },
        {
          id: "action-2", 
          label: "Driver Training",
          type: "secondary"
        }
      ]
    },
    {
      id: "agent-2",
      title: "Pricing Optimization Alert",
      what: "Quote Q-1045 margin 8.2% below lane average - recommend R2,400 increase",
      impactZAR: 2400,
      confidence: 0.73,
      why: [
        "Current lane average margin is 12.4% vs quoted 8.2%",
        "Fuel costs increased 6% since last rate adjustment",
        "Customer acceptance probability remains high at 67%"
      ],
      actions: [
        {
          id: "action-3",
          label: "Adjust Quote",
          type: "primary"
        },
        {
          id: "action-4",
          label: "Review History",
          type: "secondary"
        }
      ]
    },
    {
      id: "agent-3", 
      title: "Cash Flow Acceleration",
      what: "Invoice INV-891 eligible for R38,500 advance - improve DSO by 12 days",
      impactZAR: 1250,
      confidence: 0.91,
      why: [
        "POD verified and customer credit score is 89%",
        "Early payment would reduce DSO from 47 to 35 days",
        "Advance rate of 85% available with premium terms"
      ],
      actions: [
        {
          id: "action-5",
          label: "Request Advance",
          type: "primary"
        },
        {
          id: "action-6",
          label: "View Terms",
          type: "secondary"
        }
      ]
    },
    {
      id: "agent-4",
      title: "Fleet Utilization Gap",
      what: "Vehicle TRK-007 idle for 23 hours - potential load match available",
      impactZAR: 8950,
      confidence: 0.64,
      why: [
        "Load L-445 from DBN-JHB matches vehicle capacity",
        "Current position allows pickup within 2-hour window", 
        "Margin projection 16.8% with existing rate structure"
      ],
      actions: [
        {
          id: "action-7",
          label: "Accept Load",
          type: "primary"
        },
        {
          id: "action-8",
          label: "Alternative Loads",
          type: "secondary"
        }
      ]
    },
    {
      id: "agent-5",
      title: "Border Delay Prediction",
      what: "Beitbridge crossing delay expected - reroute via Lebombo saves 3.2 hours",
      impactZAR: 1850,
      confidence: 0.78,
      why: [
        "Current Beitbridge queue time: 4.5 hours (195% above normal)",
        "Lebombo alternative adds 45km but saves 3.2 hours total",
        "Customer delivery window accommodates reroute timing"
      ],
      actions: [
        {
          id: "action-9",
          label: "Reroute Now",
          type: "primary"
        },
        {
          id: "action-10",
          label: "Monitor Queue",
          type: "secondary"
        }
      ]
    },
    {
      id: "agent-6",
      title: "Maintenance Schedule Optimization",
      what: "TRK-012 due for service - optimize timing to avoid peak delivery period",
      impactZAR: 3200,
      confidence: 0.82,
      why: [
        "Service window coincides with high-demand Friday schedule",
        "Delaying 48 hours avoids R5,200 in opportunity costs",
        "Vehicle condition allows safe operation until Monday"
      ],
      actions: [
        {
          id: "action-11",
          label: "Reschedule Service",
          type: "primary"
        },
        {
          id: "action-12",
          label: "Emergency Check",
          type: "destructive"
        }
      ]
    }
  ];

  // Filter agents by module
  switch (module) {
    case 'revenue':
      return baseAgents.filter(agent => 
        agent.title.includes('Pricing') || 
        agent.title.includes('Quote') ||
        agent.title.includes('Margin')
      );
    case 'control':
      return baseAgents.filter(agent => 
        agent.title.includes('Route') || 
        agent.title.includes('Fleet') ||
        agent.title.includes('Border') ||
        agent.title.includes('Maintenance')
      );
    case 'finance': 
      return baseAgents.filter(agent =>
        agent.title.includes('Cash Flow') ||
        agent.title.includes('Invoice') ||
        agent.title.includes('DSO')
      );
    case 'capital':
      return baseAgents.filter(agent =>
        agent.title.includes('Cash') ||
        agent.title.includes('Advance') ||
        agent.title.includes('Invoice')
      );
    case 'fleet':
      return baseAgents.filter(agent =>
        agent.title.includes('Fleet') ||
        agent.title.includes('Vehicle') ||
        agent.title.includes('Fuel') ||
        agent.title.includes('Utilization')
      );
    default:
      return baseAgents.slice(0, 4); // Return first 4 for overview
  }
};