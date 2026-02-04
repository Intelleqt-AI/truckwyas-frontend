import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { Truck, Fuel, Landmark, Wrench, Users, Building2 } from 'lucide-react';

interface Node {
  id: string;
  type: 'customer' | 'vehicle' | 'lane' | 'costCenter';
  label: string;
  logoUrl?: string;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

interface Link {
  source: string | Node;
  target: string | Node;
  value: number;
  marginPct?: number;
  type: 'revenue' | 'assignment' | 'cost';
}

interface EconomicModelProps {
  data: {
    nodes: Node[];
    links: Link[];
  };
  onNodeClick?: (node: Node) => void;
  onNodeHover?: (node: Node | null) => void;
  scenarioMode?: boolean;
  fuelPriceChange?: number;
}

const EconomicModelVisualization: React.FC<EconomicModelProps> = ({
  data,
  onNodeClick,
  onNodeHover,
  scenarioMode = false,
  fuelPriceChange = 0
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  useEffect(() => {
    const handleResize = () => {
      const container = svgRef.current?.parentElement;
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: container.clientHeight
        });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = dimensions;

    // Create container group
    const container = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Add patterns and filters
    const defs = svg.append('defs');
    
    // Grid pattern
    const pattern = defs.append('pattern')
      .attr('id', 'grid')
      .attr('width', 20)
      .attr('height', 20)
      .attr('patternUnits', 'userSpaceOnUse');

    pattern.append('rect')
      .attr('width', 20)
      .attr('height', 20)
      .attr('fill', 'hsl(var(--surface))');

    pattern.append('path')
      .attr('d', 'M 20 0 L 0 0 0 20')
      .attr('fill', 'none')
      .attr('stroke', 'hsl(var(--grid-line))')
      .attr('stroke-width', 1);

    // Glow filter for customer nodes
    const glowFilter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');

    glowFilter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur');

    const feMerge = glowFilter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Pulse animation gradient
    const pulseGradient = defs.append('linearGradient')
      .attr('id', 'pulseGradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '100%').attr('y2', '0%');
    
    pulseGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', 'transparent');
    
    pulseGradient.append('stop')
      .attr('offset', '50%')
      .attr('stop-color', 'hsl(var(--primary))')
      .attr('stop-opacity', '0.8');
    
    pulseGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', 'transparent');

    // Add background with grid
    svg.insert('rect', ':first-child')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('fill', 'url(#grid)');

    // Create scaling functions
    const maxValue = d3.max(data.links, d => d.value) || 1;
    const strokeScale = d3.scaleLinear()
      .domain([0, maxValue])
      .range([1, 10]);

    const marginColorScale = d3.scaleLinear<string>()
      .domain([-10, 0, 20])
      .range(['hsl(var(--danger-500))', 'hsl(var(--muted-foreground))', 'hsl(var(--success-500))']);

    // Create force simulation
    const simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links).id(d => (d as Node).id).distance(180))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50));

    // Create link groups for animation
    const linkGroups = container.selectAll('.link-group')
      .data(data.links)
      .enter()
      .append('g')
      .attr('class', 'link-group');

    // Main links
    const links = linkGroups.append('line')
      .attr('class', 'link')
      .attr('stroke-width', d => strokeScale(d.value))
      .attr('stroke', d => {
        if (d.type === 'revenue' && d.marginPct !== undefined) {
          return marginColorScale(d.marginPct);
        } else if (d.type === 'cost') {
          return 'hsl(var(--danger-500))';
        }
        return 'hsl(var(--muted-foreground))';
      })
      .attr('opacity', 0.8)
      .attr('stroke-linecap', 'round');

    // Pulse animation links
    const pulseLinks = linkGroups.append('line')
      .attr('class', 'pulse-link')
      .attr('stroke-width', d => strokeScale(d.value) * 0.5)
      .attr('stroke', 'url(#pulseGradient)')
      .attr('stroke-dasharray', '5,10')
      .attr('opacity', 0.6)
      .style('animation', 'pulse 2s linear infinite');

    // Add CSS animation for pulse effect
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { stroke-dashoffset: 0; }
        100% { stroke-dashoffset: 15; }
      }
    `;
    document.head.appendChild(style);

    // Create nodes
    const nodes = container.selectAll('.node')
      .data(data.nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer');

    // Add node shapes with enhanced rendering
    nodes.each(function(d) {
      const node = d3.select(this);
      
      if (d.type === 'customer') {
        // Calculate profit for glow color
        const customerLinks = data.links.filter(link => link.source === d.id);
        const avgMargin = customerLinks.reduce((sum, link) => sum + (link.marginPct || 0), 0) / customerLinks.length;
        const glowColor = avgMargin > 0 ? 'hsl(var(--success-500))' : 'hsl(var(--danger-500))';

        // Main circle with glow
        node.append('circle')
          .attr('r', 30)
          .attr('fill', 'hsl(var(--primary))')
          .attr('stroke', glowColor)
          .attr('stroke-width', 3)
          .attr('filter', 'url(#glow)')
          .style('stroke-opacity', 0.7);
          
        // Logo placeholder (small circle)
        node.append('circle')
          .attr('r', 15)
          .attr('fill', 'hsl(var(--primary-foreground))')
          .attr('stroke', 'hsl(var(--border))')
          .attr('stroke-width', 1);

        // Company initial
        node.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '.35em')
          .attr('fill', 'hsl(var(--primary))')
          .attr('font-size', '12px')
          .attr('font-weight', '600')
          .text(d.label.charAt(0));

      } else if (d.type === 'vehicle') {
        // Vehicle circle
        node.append('circle')
          .attr('r', 20)
          .attr('fill', 'hsl(var(--secondary))')
          .attr('stroke', d.id === selectedNode?.id ? 'hsl(var(--ring))' : 'hsl(var(--border))')
          .attr('stroke-width', d.id === selectedNode?.id ? 3 : 2);

        // Truck icon using SVG path (simplified truck shape)
        node.append('path')
          .attr('d', 'M-8,-6 L6,-6 L6,-2 L8,-2 L8,2 L6,2 L6,6 L-8,6 Z M-6,0 L4,0 M-2,-4 L-2,4 M2,-4 L2,4')
          .attr('stroke', 'hsl(var(--secondary-foreground))')
          .attr('stroke-width', '1.5')
          .attr('fill', 'none')
          .attr('stroke-linecap', 'round');

      } else if (d.type === 'lane') {
        // Lane circle
        node.append('circle')
          .attr('r', 12)
          .attr('fill', 'hsl(var(--accent))')
          .attr('stroke', d.id === selectedNode?.id ? 'hsl(var(--ring))' : 'hsl(var(--border))')
          .attr('stroke-width', d.id === selectedNode?.id ? 3 : 1);

        // Lane text (only show on hover for small nodes)
        const labelText = node.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '.35em')
          .attr('fill', 'hsl(var(--accent-foreground))')
          .attr('font-size', '8px')
          .attr('font-weight', '500')
          .text(d.label)
          .style('opacity', 0);

      } else if (d.type === 'costCenter') {
        // Cost center square
        node.append('rect')
          .attr('x', -12)
          .attr('y', -12)
          .attr('width', 24)
          .attr('height', 24)
          .attr('rx', 4)
          .attr('fill', d.id === 'cost_fuel' && fuelPriceChange > 0 ? 'hsl(var(--danger-500))' : 'hsl(var(--muted))')
          .attr('stroke', d.id === selectedNode?.id ? 'hsl(var(--ring))' : 'hsl(var(--border))')
          .attr('stroke-width', d.id === selectedNode?.id ? 3 : 1);

        // Cost center icons
        let iconPath = '';
        if (d.id === 'cost_fuel') {
          iconPath = 'M2,12 L12,2 L22,12 M12,2 L12,22'; // Fuel pump simplified
        } else if (d.id === 'cost_tolls') {
          iconPath = 'M3,12 L21,12 M12,3 L12,21'; // Plus for tolls
        } else if (d.id === 'cost_maint') {
          iconPath = 'M14.7,6.3 L18,3 L21,6 L17.7,9.3 M9,12 L17,4'; // Wrench simplified
        } else if (d.id === 'cost_payroll') {
          iconPath = 'M20,21 L16,17 L12,21 L8,17 L4,21'; // Users simplified
        }

        if (iconPath) {
          node.append('path')
            .attr('d', iconPath)
            .attr('stroke', 'hsl(var(--muted-foreground))')
            .attr('stroke-width', '1.5')
            .attr('fill', 'none')
            .attr('stroke-linecap', 'round')
            .attr('transform', 'translate(-12, -12) scale(0.6)');
        }
      }
    });

    // Add labels below nodes (with smart visibility)
    const nodeLabels = nodes.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.type === 'customer' ? '3.5em' : d.type === 'vehicle' ? '3em' : '2.5em')
      .attr('fill', 'hsl(var(--muted-foreground))')
      .attr('font-size', d => d.type === 'customer' ? '11px' : d.type === 'vehicle' ? '10px' : '9px')
      .attr('font-weight', '500')
      .text(d => d.label)
      .style('opacity', d => d.type === 'lane' ? 0 : 1); // Hide lane labels initially

    // Add interactions with enhanced hover effects
    nodes
      .on('mouseenter', function(event, d) {
        // Highlight connected links
        linkGroups.style('opacity', link => 
          link.source === d || link.target === d ? 1 : 0.2
        );
        
        // Highlight connected nodes
        nodes.style('opacity', node => {
          const isConnected = data.links.some(link => 
            (link.source === d && link.target === node) || 
            (link.target === d && link.source === node)
          );
          return node === d || isConnected ? 1 : 0.3;
        });

        // Show lane labels on hover
        if (d.type === 'lane') {
          d3.select(this).select('text').style('opacity', 1);
        }

        onNodeHover?.(d);
      })
      .on('mouseleave', function(event, d) {
        linkGroups.style('opacity', 0.8);
        nodes.style('opacity', 1);
        
        // Hide lane labels when not hovering
        if (d.type === 'lane') {
          d3.select(this).select('text').style('opacity', 0);
        }
        
        onNodeHover?.(null);
      })
      .on('click', function(event, d) {
        setSelectedNode(selectedNode?.id === d.id ? null : d);
        onNodeClick?.(d);
      });

    // Add drag behavior
    const drag = d3.drag()
      .on('start', (event, d: any) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d: any) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d: any) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodes.call(drag);

    // Update positions on simulation tick
    simulation.on('tick', () => {
      linkGroups.selectAll('line')
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodes.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

  }, [data, dimensions, selectedNode, fuelPriceChange]);

  return (
    <div className="w-full h-full relative">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="bg-surface border border-border rounded-lg"
      />
    </div>
  );
};

export default EconomicModelVisualization;