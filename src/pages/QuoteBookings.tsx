import { useState } from "react";
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

// Mock booking data - these are accepted quotes that became jobs
const mockBookings = [
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

  const filteredBookings = mockBookings.filter(booking => 
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
    <div className="min-h-screen bg-gradient-dashboard p-6">
      
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display-h1 font-display-bold text-brand-900">Quote Bookings</h1>
            <p className="text-body text-neutral-600 mt-2">Track confirmed quotes and manage job execution</p>
          </div>
        </div>
      </motion.div>

      {/* Status Overview Cards */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-4 gap-4 mb-6"
      >
        <Card className="bg-card/80 backdrop-blur-sm border-border">
          <CardContent className="p-4 text-center">
            <div className="text-display-h3 font-display-bold text-primary text-tabular">
              {mockBookings.length}
            </div>
            <div className="text-caption text-muted-foreground">Total Bookings</div>
          </CardContent>
        </Card>
        
        <Card className="bg-card/80 backdrop-blur-sm border-border">
          <CardContent className="p-4 text-center">
            <div className="text-display-h3 font-display-bold text-warning text-tabular">
              {mockBookings.filter(b => b.status === "In Transit").length}
            </div>
            <div className="text-caption text-muted-foreground">In Transit</div>
          </CardContent>
        </Card>
        
        <Card className="bg-card/80 backdrop-blur-sm border-border">
          <CardContent className="p-4 text-center">
            <div className="text-display-h3 font-display-bold text-success text-tabular">
              {mockBookings.filter(b => b.podVerified).length}
            </div>
            <div className="text-caption text-muted-foreground">POD Verified</div>
          </CardContent>
        </Card>
        
        <Card className="bg-card/80 backdrop-blur-sm border-border">
          <CardContent className="p-4 text-center">
            <div className="text-display-h3 font-display-bold text-primary text-tabular">
              {formatCurrency(mockBookings.reduce((sum, b) => sum + b.price, 0))}
            </div>
            <div className="text-caption text-muted-foreground">Total Value</div>
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
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
        className="space-y-4"
      >
        {filteredBookings.map((booking) => {
          const statusBadge = getStatusBadge(booking.status);
          const invoiceBadge = getInvoiceStatusBadge(booking.invoiceStatus);
          const isExpanded = expandedBooking === booking.id;
          
          return (
            <Card key={booking.id} className="bg-card/80 backdrop-blur-sm border-border overflow-hidden">
              
              {/* Main Booking Row */}
              <div 
                className="p-4 cursor-pointer hover:bg-muted/5 transition-colors"
                onClick={() => toggleExpanded(booking.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                    
                    <div>
                      <div className="text-body-medium font-body-medium text-foreground">
                        {booking.id} • {booking.customer}
                      </div>
                      <div className="text-caption text-muted-foreground">
                        {booking.origin} → {booking.destination} • {booking.slaHours}h SLA
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-body-medium font-body-medium text-foreground text-tabular">
                        {formatCurrency(booking.price)}
                      </div>
                      <div className="text-caption text-muted-foreground">
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
                  className="border-t border-border"
                >
                  <div className="p-4 bg-muted/10">
                    <div className="grid grid-cols-3 gap-6">
                      
                      {/* Vehicle & Driver Info */}
                      <div className="space-y-3">
                        <div className="text-body-medium font-body-medium text-foreground mb-2">
                          Assignment Details
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="text-body text-foreground">{booking.vehicle}</div>
                            <div className="text-caption text-muted-foreground">Vehicle</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="text-body text-foreground">{booking.driver}</div>
                            <div className="text-caption text-muted-foreground">Driver</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="text-body text-foreground">
                              Delivery: {new Date(booking.deliveryDate).toLocaleDateString()}
                            </div>
                            <div className="text-caption text-muted-foreground">Expected</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Status Indicators */}
                      <div className="space-y-3">
                        <div className="text-body-medium font-body-medium text-foreground mb-2">
                          Status Tracking
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {booking.podVerified ? (
                            <CheckCircle className="w-4 h-4 text-success" />
                          ) : (
                            <Clock className="w-4 h-4 text-muted-foreground" />
                          )}
                          <div>
                            <div className="text-body text-foreground">
                              POD {booking.podVerified ? "Verified" : "Pending"}
                            </div>
                            <div className="text-caption text-muted-foreground">
                              Proof of Delivery
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {booking.invoiceStatus === "Sent" ? (
                            <CheckCircle className="w-4 h-4 text-primary" />
                          ) : booking.invoiceStatus === "Paid" ? (
                            <CheckCircle className="w-4 h-4 text-success" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-warning" />
                          )}
                          <div>
                            <div className="text-body text-foreground">
                              Invoice {booking.invoiceStatus}
                            </div>
                            <div className="text-caption text-muted-foreground">
                              Billing Status
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* AI Next Steps */}
                      <div className="space-y-3">
                        <div className="text-body-medium font-body-medium text-foreground mb-2">
                          AI Next Steps
                        </div>
                        
                        <div className="space-y-2">
                          {booking.nextSteps.map((step, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                              <div className="text-caption text-foreground">{step}</div>
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