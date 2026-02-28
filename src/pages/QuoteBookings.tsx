import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Truck,
  User,
  MapPin,
  CheckCircle,
  AlertCircle,
  Clock
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { fetchData } from "@/lib/Api";

const emptyBookings = [
  {
    id: "Q-1003",
    customer: "Shoprite Holdings",
    origin: "JHB",
    destination: "CPT",
    slaHours: 36,
    price: 19200,
    vehicle: "V-04 HINO",
    driver: "John Mthembu",
    status: "In Transit",
    invoiceStatus: "Pending",
    podVerified: false,
    pickupDate: "2025-09-05",
    deliveryDate: "2025-09-06",
    nextSteps: ["Verify POD upon delivery", "Submit invoice within 24h", "Update delivery confirmation"]
  },
  {
    id: "Q-0987",
    customer: "Pick n Pay",
    origin: "CPT",
    destination: "PE",
    slaHours: 24,
    price: 13400,
    vehicle: "V-07 FUSO",
    driver: "Sarah Nkomo",
    status: "Delivered",
    invoiceStatus: "Sent",
    podVerified: true,
    pickupDate: "2025-09-03",
    deliveryDate: "2025-09-04",
    nextSteps: ["Follow up on payment", "Schedule vehicle maintenance"]
  },
  {
    id: "Q-0965",
    customer: "Woolworths",
    origin: "DBN",
    destination: "CPT",
    slaHours: 48,
    price: 16800,
    vehicle: "V-02 VOLVO",
    driver: "Michael Phiri",
    status: "Pickup Scheduled",
    invoiceStatus: "Not Started",
    podVerified: false,
    pickupDate: "2025-09-06",
    deliveryDate: "2025-09-07",
    nextSteps: ["Confirm pickup time with customer", "Brief driver on special requirements", "Prepare delivery documentation"]
  }
];

export function QuoteBookings() {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData('api/v1/loads/?status=IN_TRANSIT,DELIVERED,LOADING&limit=100')
      .then(d => {
        const raw = d?.results || d || [];
        const mapped = raw.map((l: any) => ({
          id: l.load_number || `Q-${l.id}`,
          customer: l.customer_name || l.customer || 'Unknown',
          origin: l.pickup_location?.substring(0, 20) || 'Unknown',
          destination: l.delivery_location?.substring(0, 20) || 'Unknown',
          slaHours: l.sla_hours || 36,
          price: parseFloat(l.total_amount || l.amount || '0'),
          vehicle: l.vehicle_name || l.vehicle || 'Unassigned',
          driver: l.driver_name || l.driver || 'Unassigned',
          status: l.status === 'IN_TRANSIT' ? 'In Transit' : l.status === 'DELIVERED' ? 'Delivered' : l.status === 'LOADING' ? 'Pickup Scheduled' : 'Planned',
          invoiceStatus: l.invoice_status || 'Pending',
          podVerified: l.status === 'DELIVERED',
          pickupDate: l.pickup_date || l.created_at?.split('T')[0] || '',
          deliveryDate: l.delivery_date || '',
          nextSteps: ['Verify POD upon delivery', 'Submit invoice within 24h']
        }));
        setBookings(mapped);
      })
      .catch(() => setBookings(emptyBookings))
      .finally(() => setLoading(false));
  }, []);

  const filteredBookings = bookings.filter(booking => 
    booking.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    booking.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
    booking.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
    booking.vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    booking.driver.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pickup Scheduled": return { variant: "outline" as const, color: "text-primary" };
      case "In Transit": return { variant: "default" as const, color: "text-warning" };
      case "Delivered": return { variant: "default" as const, color: "text-success" };
      default: return { variant: "secondary" as const, color: "text-muted-foreground" };
    }
  };

  const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case "Pending": return { variant: "secondary" as const, color: "text-warning" };
      case "Sent": return { variant: "default" as const, color: "text-primary" };
      case "Paid": return { variant: "default" as const, color: "text-success" };
      case "Not Started": return { variant: "outline" as const, color: "text-muted-foreground" };
      default: return { variant: "secondary" as const, color: "text-muted-foreground" };
    }
  };

  const toggleExpanded = (bookingId: string) => {
    setExpandedBooking(expandedBooking === bookingId ? null : bookingId);
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#0F172A]">Quote Bookings</h1>
            <p className="text-sm text-[#64748B] mt-1">Track confirmed quotes and manage job execution</p>
          </div>
        </div>
      </motion.div>

      {/* Status Overview Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-4 gap-4 mb-6"
      >
        <Card className="border-[#E2E8F0] bg-white rounded-md">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-semibold text-[#2563EB] font-mono tabular-nums">
              {loading ? '...' : bookings.length}
            </div>
            <div className="text-xs text-[#94A3B8] mt-1">Total Bookings</div>
          </CardContent>
        </Card>

        <Card className="border-[#E2E8F0] bg-white rounded-md">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-semibold text-[#F59E0B] font-mono tabular-nums">
              {loading ? '...' : bookings.filter(b => b.status === "In Transit").length}
            </div>
            <div className="text-xs text-[#94A3B8] mt-1">In Transit</div>
          </CardContent>
        </Card>

        <Card className="border-[#E2E8F0] bg-white rounded-md">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-semibold text-[#10B981] font-mono tabular-nums">
              {loading ? '...' : bookings.filter(b => b.podVerified).length}
            </div>
            <div className="text-xs text-[#94A3B8] mt-1">POD Verified</div>
          </CardContent>
        </Card>

        <Card className="border-[#E2E8F0] bg-white rounded-md">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-semibold text-[#0F172A] font-mono tabular-nums">
              {loading ? '...' : formatCurrency(bookings.reduce((sum, b) => sum + b.price, 0))}
            </div>
            <div className="text-xs text-[#94A3B8] mt-1">Total Value</div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Search & Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
            <Input
              placeholder="Search bookings by customer, vehicle, driver, or lane..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
        </div>
      </motion.div>

      {/* Bookings List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3"
      >
        {filteredBookings.map((booking) => {
          const statusBadge = getStatusBadge(booking.status);
          const invoiceBadge = getInvoiceStatusBadge(booking.invoiceStatus);
          const isExpanded = expandedBooking === booking.id;

          return (
            <Card key={booking.id} className="border-[#E2E8F0] bg-white rounded-md overflow-hidden">

              {/* Main Booking Row */}
              <div
                className="p-4 cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                onClick={() => toggleExpanded(booking.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                    )}

                    <div>
                      <div className="text-sm font-medium text-[#0F172A]">
                        {booking.id} • {booking.customer}
                      </div>
                      <div className="text-xs text-[#64748B]">
                        {booking.origin} → {booking.destination} • {booking.slaHours}h SLA
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-sm font-medium text-[#0F172A] font-mono tabular-nums">
                        {formatCurrency(booking.price)}
                      </div>
                      <div className="text-xs text-[#64748B]">
                        Pickup: {new Date(booking.pickupDate).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={statusBadge.variant} className={statusBadge.color}>
                        {booking.status}
                      </Badge>
                      <Badge variant={invoiceBadge.variant} className={invoiceBadge.color}>
                        Invoice: {booking.invoiceStatus}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-[#E2E8F0]"
                >
                  <div className="p-4 bg-[#F8FAFC]">
                    <div className="grid grid-cols-3 gap-6">

                      {/* Vehicle & Driver Info */}
                      <div className="space-y-3">
                        <div className="text-sm font-medium text-[#0F172A] mb-2">
                          Assignment Details
                        </div>

                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-[#64748B]" />
                          <div>
                            <div className="text-sm text-[#0F172A]">{booking.vehicle}</div>
                            <div className="text-xs text-[#94A3B8]">Vehicle</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-[#64748B]" />
                          <div>
                            <div className="text-sm text-[#0F172A]">{booking.driver}</div>
                            <div className="text-xs text-[#94A3B8]">Driver</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[#64748B]" />
                          <div>
                            <div className="text-sm text-[#0F172A]">
                              Delivery: {new Date(booking.deliveryDate).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-[#94A3B8]">Expected</div>
                          </div>
                        </div>
                      </div>

                      {/* Status Indicators */}
                      <div className="space-y-3">
                        <div className="text-sm font-medium text-[#0F172A] mb-2">
                          Status Tracking
                        </div>

                        <div className="flex items-center gap-2">
                          {booking.podVerified ? (
                            <CheckCircle className="w-4 h-4 text-[#10B981]" />
                          ) : (
                            <Clock className="w-4 h-4 text-[#94A3B8]" />
                          )}
                          <div>
                            <div className="text-sm text-[#0F172A]">
                              POD {booking.podVerified ? "Verified" : "Pending"}
                            </div>
                            <div className="text-xs text-[#94A3B8]">
                              Proof of Delivery
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {booking.invoiceStatus === "Sent" ? (
                            <CheckCircle className="w-4 h-4 text-[#2563EB]" />
                          ) : booking.invoiceStatus === "Paid" ? (
                            <CheckCircle className="w-4 h-4 text-[#10B981]" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-[#F59E0B]" />
                          )}
                          <div>
                            <div className="text-sm text-[#0F172A]">
                              Invoice {booking.invoiceStatus}
                            </div>
                            <div className="text-xs text-[#94A3B8]">
                              Billing Status
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* AI Next Steps */}
                      <div className="space-y-3">
                        <div className="text-sm font-medium text-[#0F172A] mb-2">
                          AI Next Steps
                        </div>

                        <div className="space-y-2">
                          {booking.nextSteps.map((step, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <div className="w-1.5 h-1.5 bg-[#2563EB] rounded-full mt-1.5 flex-shrink-0" />
                              <div className="text-xs text-[#475569]">{step}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </Card>
          );
        })}
      </motion.div>
    </div>
  );
}