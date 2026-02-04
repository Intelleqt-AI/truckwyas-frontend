import { Timer, AlertTriangle, Clock, TrendingDown } from "lucide-react";
import { SignalCard } from "@/components/overview/SignalCard";
import { BusinessHealthSummary } from "@/components/overview/BusinessHealthSummary";
import { AIInsightsFeed } from "@/components/overview/AIInsightsFeed";
import { RecentActivityFeed } from "@/components/activity/RecentActivityFeed";
import { motion } from "framer-motion";
import bookingsOverviewData from "@/mocks/bookings-overview.json";

export default function Overview() {
  // Signal cards data - mission-critical alerts
  const signals = [
    {
      icon: Timer,
      title: "Expiring Quotes",
      value: "3 Quotes",
      subtitle: "Value: R 88,400",
      buttonText: "Review Now",
      variant: 'default' as const,
      onClick: () => console.log('Navigate to expiring quotes')
    },
    {
      icon: AlertTriangle,
      title: "At-Risk Margin",
      value: "5 Loads Flagged",
      subtitle: "Potential Loss: R 18,200",
      buttonText: "Analyse Loads",
      variant: 'warning' as const,
      onClick: () => console.log('Navigate to at-risk loads')
    },
    {
      icon: Clock,
      title: "Overdue Payments",
      value: "R 254,000",
      subtitle: "from 2 Customers",
      buttonText: "View Invoices",
      variant: 'danger' as const,
      onClick: () => console.log('Navigate to overdue invoices')
    },
    {
      icon: TrendingDown,
      title: "Fleet Inefficiencies",
      value: "2 Vehicles Flagged",
      subtitle: "High Fuel Burn",
      buttonText: "Investigate Fleet",
      variant: 'default' as const,
      onClick: () => console.log('Navigate to fleet issues')
    }
  ];

  return (
    <div className="space-y-8">
      {/* Mission-Critical Signals - HERO SECTION */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {signals.map((signal, index) => (
            <motion.div
              key={signal.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
            >
              <SignalCard {...signal} />
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Business Health Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <BusinessHealthSummary />
      </motion.div>

      {/* Bottom Section - AI Insights & Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AI Insights Feed - Left Column */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
          >
            <AIInsightsFeed />
          </motion.div>
          
          {/* Recent Activity - Right Column */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
          >
            <RecentActivityFeed 
              activities={bookingsOverviewData.activityFeedData}
              title="Live Activity"
            />
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}