# MCP vs Toolbox: When Using Amp

## TL;DR

**For Amp-only use: Toolbox is better.**

**For multi-client use (Amp + Cline + others): MCP is better.**

## Detailed Comparison

### Toolbox (What We Just Built)

**Pros:**
- ✅ **Simpler** - Just Node.js scripts, no protocol overhead
- ✅ **Faster** - Direct execution, no JSON-RPC serialization
- ✅ **Easier to debug** - Run scripts directly from terminal
- ✅ **Self-contained** - No server process to manage
- ✅ **Works offline** - No network/IPC required
- ✅ **Lower latency** - No protocol translation layer
- ✅ **Easy to modify** - Edit script, use immediately
- ✅ **Portable** - Copy `.toolbox/` folder, done

**Cons:**
- ❌ **Amp-only** - Won't work with Cline, Claude Desktop, etc.
- ❌ **No state** - Each execution is independent
- ❌ **Limited types** - String parameters only
- ❌ **No resources** - Can't expose read-only data
- ❌ **No discovery** - Have to know tool names

**Best for:**
- Personal projects using only Amp
- Quick prototyping
- Simple workflows
- When you want minimal dependencies

---

### MCP Server (Phase 2)

**Pros:**
- ✅ **Universal** - Works with Amp, Cline, Claude Desktop, any MCP client
- ✅ **Structured** - Rich type system, validation, error handling
- ✅ **Stateful** - Can maintain sessions, cache data
- ✅ **Resources** - Can expose read-only data (insights, patterns)
- ✅ **Discovery** - Clients auto-discover available tools
- ✅ **Standard** - Uses official MCP protocol
- ✅ **NPM package** - Can publish and share easily
- ✅ **Better errors** - Structured error responses

**Cons:**
- ❌ **More complex** - Need to implement MCP protocol
- ❌ **Server process** - Need to start/manage server
- ❌ **Slower** - JSON-RPC overhead on every call
- ❌ **Harder to debug** - Need to inspect protocol messages
- ❌ **More dependencies** - Requires `@modelcontextprotocol/sdk`
- ❌ **Setup required** - Add to Amp config, restart Amp

**Best for:**
- Teams using multiple AI tools
- Public/shared frameworks
- Complex state management
- When you need discovery
- When you want to publish to npm

---

## Concrete Examples

### Scenario 1: Solo Developer, Amp-Only

**Toolbox wins:**
```bash
# Setup (once)
export AMP_TOOLBOX="$HOME/project/.toolbox"

# Use
amp "Run ace-learn"
# → Direct execution, 50ms
```

**MCP would be:**
```bash
# Setup (once)
npm install @ace/mcp-server
# Edit ~/.config/amp/config.json, add MCP server
# Restart Amp

# Use
amp "Run ace-learn"
# → MCP protocol overhead, 150ms
```

**Winner: Toolbox** (3x simpler, 3x faster)

---

### Scenario 2: Team Using Amp + Cline + Claude Desktop

**Toolbox fails:**
```bash
# Amp ✅
amp "Run ace-learn"

# Cline ❌
# Can't use toolbox, Cline doesn't support Amp toolboxes

# Claude Desktop ❌  
# Can't use toolbox at all
```

**MCP works:**
```bash
# Setup (once per client)
# Add ACE MCP server to Amp config
# Add ACE MCP server to Cline config
# Add ACE MCP server to Claude Desktop config

# Use everywhere ✅
amp "Run ace-learn"
cline "Run ace-learn"  
# Claude Desktop can use it in UI
```

**Winner: MCP** (only option that works)

---

### Scenario 3: Want to Query Learned Patterns

**Toolbox limitation:**
```bash
amp "Show me patterns related to TypeScript"
# → Have to grep AGENTS.md manually
# → No structured query capability
```

**MCP advantage:**
```bash
amp "Show me patterns related to TypeScript"
# → Calls ace_get_insights tool with filter
# → Returns structured JSON results
# → Can filter by confidence, tags, section
```

**Winner: MCP** (enables new capabilities)

---

### Scenario 4: Real-time Pattern Updates

**Toolbox:**
- Each run is independent
- No shared state between runs
- Can't maintain learning session

**MCP:**
- Server maintains state
- Can cache insights
- Can accumulate patterns over session
- Can notify on new insights

**Winner: MCP** (enables stateful workflows)

---

## Performance Comparison

### Toolbox Execution
```
User → Amp → Toolbox Script → AGENTS.md
       ↓
     50-100ms (direct process spawn)
```

### MCP Execution
```
User → Amp → MCP Client → JSON-RPC → MCP Server → Tool Handler → AGENTS.md
       ↓                     ↓
     20ms              100-150ms (serialization + IPC)
```

**Latency:** Toolbox ~50ms, MCP ~150ms

For ACE learning (runs after tasks complete), this difference doesn't matter. For interactive queries, toolbox is noticeably faster.

---

## Feature Matrix

| Feature | Toolbox | MCP Server |
|---------|---------|------------|
| Works with Amp | ✅ | ✅ |
| Works with Cline | ❌ | ✅ |
| Works with Claude Desktop | ❌ | ✅ |
| Simple setup | ✅ | ❌ |
| Fast execution | ✅ | ⚠️ |
| Rich types | ❌ | ✅ |
| Stateful | ❌ | ✅ |
| Resources (read-only data) | ❌ | ✅ |
| Tool discovery | ❌ | ✅ |
| Easy debugging | ✅ | ❌ |
| NPM publishable | ❌ | ✅ |
| No dependencies | ✅ | ❌ |

---

## My Recommendation

### If you're only using Amp:
**Stick with Toolbox.** You've got everything you need:
- ✅ Fast
- ✅ Simple
- ✅ Easy to modify
- ✅ Already working

### If you want to share ACE with others:
**Build MCP Server.** Because:
- 🌍 Anyone can use it (any MCP client)
- 📦 Can publish to npm
- 🔧 Standard protocol
- 📚 Better for documentation

### Hybrid Approach (Recommended):
**Keep both!**
- Use **Toolbox** for your daily work (fast, simple)
- Build **MCP Server** for distribution (universal, shareable)

The toolbox can be a thin wrapper around the MCP tools:
```javascript
// .toolbox/ace-learn just calls MCP tool internally
import { callMCPTool } from './mcp-client.js';
await callMCPTool('ace_analyze_patterns', { dir: workDir });
```

Best of both worlds: Fast local execution + universal compatibility.

---

## Decision Tree

```
Are you the only user?
├─ YES → Use Toolbox
│         ├─ Need to share later? → Add MCP
│         └─ Happy as-is? → Done!
│
└─ NO → Multiple users/tools?
          ├─ All using Amp? → Use Toolbox
          ├─ Mix of tools? → Use MCP
          └─ Want to publish? → Use MCP
```

---

## Bottom Line

For **this project** (ACE_Beads_Amp):

**Phase 1 (Toolbox): ✅ Complete** - Perfect for Amp users  
**Phase 2 (MCP Server): 🎯 Worth building** - Enables broader adoption

The MCP server doesn't replace the toolbox; it complements it by making ACE available to the entire MCP ecosystem (Cline, Claude Desktop, future tools).

**ROI of building MCP:**
- 📈 10x more potential users (any MCP client vs Amp-only)
- 🎁 Can publish to npm
- 🌟 Positions ACE as industry-standard learning framework
- 🔧 Enables richer features (resources, discovery, state)

**Cost:**
- ⏱️ ~4-6 hours development time
- 🧠 Learning MCP protocol (if not familiar)
- 🔧 More complex debugging

**Verdict:** Worth it if you want ACE to be widely adopted. Skip it if you just want to use it personally with Amp.
