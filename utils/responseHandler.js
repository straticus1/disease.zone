/**
 * Dual Response Handler for diseaseZone
 * Automatically serves JSON for API clients and HTML for web browsers
 */

class ResponseHandler {
  static isApiRequest(req) {
    // Check if request is from API client
    const acceptHeader = req.get('Accept') || '';
    const userAgent = req.get('User-Agent') || '';

    // API indicators
    return (
      acceptHeader.includes('application/json') ||
      userAgent.includes('curl') ||
      userAgent.includes('Postman') ||
      userAgent.includes('insomnia') ||
      req.query.format === 'json' ||
      req.headers['x-api-request'] === 'true'
    );
  }

  static sendResponse(req, res, data, options = {}) {
    const {
      title = 'diseaseZone Data',
      description = 'Disease surveillance and tracking data',
      tableName = 'Data',
      endpoint = req.originalUrl
    } = options;

    if (this.isApiRequest(req)) {
      // Send JSON for API clients
      return res.json(data);
    }

    // Send HTML for web browsers
    const html = this.generateHTML(data, { title, description, tableName, endpoint });
    return res.send(html);
  }

  static generateHTML(data, options) {
    const { title, description, tableName, endpoint } = options;

    // Convert data to table format
    let tableContent = '';
    let breadcrumbs = this.generateBreadcrumbs(endpoint);

    if (Array.isArray(data)) {
      tableContent = this.generateTable(data, tableName);
    } else if (data.diseases) {
      tableContent = this.generateTable(data.diseases, 'Diseases');
    } else if (data.data) {
      tableContent = this.generateTable(data.data, 'Results');
    } else {
      tableContent = this.generateObjectTable(data);
    }

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - diseaseZone</title>
    <style>
        :root {
            --primary-color: #059669;
            --secondary-color: #047857;
            --success-color: #10b981;
            --warning-color: #f59e0b;
            --danger-color: #ef4444;
            --dark-color: #1f2937;
            --light-color: #f0fdf4;
            --border-color: #d1fae5;
            --text-primary: #1e293b;
            --text-secondary: #64748b;
            --medical-teal: #0d9488;
            --medical-mint: #6ee7b7;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: var(--text-primary);
            background: linear-gradient(135deg, #059669 0%, #0d9488 50%, #047857 100%);
            min-height: 100vh;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 20px;
        }

        .logo-icon {
            width: 48px;
            height: 48px;
            background: linear-gradient(45deg, var(--primary-color), var(--secondary-color));
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            font-weight: bold;
        }

        .logo h1 {
            color: var(--primary-color);
            font-size: 2.5rem;
            font-weight: 700;
            margin: 0;
        }

        .description {
            color: var(--text-secondary);
            font-size: 1.1rem;
            margin-bottom: 20px;
        }

        .breadcrumbs {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.9rem;
            color: var(--text-secondary);
        }

        .breadcrumb-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .main-content {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 0;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            overflow: hidden;
        }

        .table-header {
            background: var(--primary-color);
            color: white;
            padding: 20px 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .table-title {
            font-size: 1.5rem;
            font-weight: 600;
        }

        .controls {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .search-box {
            padding: 8px 16px;
            border: none;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            placeholder-color: rgba(255, 255, 255, 0.7);
            font-size: 0.9rem;
        }

        .search-box::placeholder {
            color: rgba(255, 255, 255, 0.7);
        }

        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 8px;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        .btn-secondary {
            background: rgba(255, 255, 255, 0.2);
            color: white;
        }

        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .table-container {
            overflow-x: auto;
            max-height: 70vh;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9rem;
        }

        th, td {
            padding: 16px 20px;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
        }

        th {
            background: var(--light-color);
            font-weight: 600;
            color: var(--text-primary);
            position: sticky;
            top: 0;
            z-index: 10;
        }

        tr:hover {
            background: rgba(5, 150, 105, 0.04);
        }

        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .badge-primary { background: rgba(5, 150, 105, 0.1); color: var(--primary-color); }
        .badge-success { background: rgba(16, 185, 129, 0.1); color: var(--success-color); }
        .badge-warning { background: rgba(245, 158, 11, 0.1); color: var(--warning-color); }
        .badge-danger { background: rgba(239, 68, 68, 0.1); color: var(--danger-color); }

        .footer {
            margin-top: 30px;
            text-align: center;
            color: rgba(255, 255, 255, 0.8);
            font-size: 0.9rem;
        }

        .api-link {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: rgba(255, 255, 255, 0.9);
            text-decoration: none;
            margin-top: 10px;
            font-size: 0.85rem;
        }

        .api-link:hover {
            color: white;
        }

        .status-indicator {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 0.8rem;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--success-color);
        }

        @media (max-width: 768px) {
            .container { padding: 10px; }
            .header { padding: 20px; }
            .logo h1 { font-size: 2rem; }
            .controls { flex-direction: column; }
            .search-box { width: 100%; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">
                <div class="logo-icon">🧬</div>
                <h1>diseaseZone</h1>
            </div>
            <p class="description">${description}</p>
            ${breadcrumbs}
        </div>

        <div class="main-content">
            <div class="table-header">
                <h2 class="table-title">${tableName}</h2>
                <div class="controls">
                    <input type="text" class="search-box" id="searchInput" placeholder="Search data...">
                    <a href="${endpoint}?format=json" class="btn btn-secondary">📋 JSON API</a>
                    <div class="status-indicator">
                        <div class="status-dot"></div>
                        <span>Live Data</span>
                    </div>
                </div>
            </div>
            <div class="table-container">
                ${tableContent}
            </div>
        </div>

        <div class="footer">
            <p>🛡️ diseaseZone v2.3.0 - Secure Disease Surveillance Platform</p>
            <a href="${endpoint}?format=json" class="api-link">🔗 Access JSON API</a>
        </div>
    </div>

    <script>
        // Search functionality
        document.getElementById('searchInput').addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('tbody tr');

            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });

        // Add interactive features
        document.querySelectorAll('tbody tr').forEach(row => {
            row.addEventListener('click', function() {
                // Remove previous selection
                document.querySelectorAll('tbody tr').forEach(r => r.style.background = '');
                // Highlight selected row
                this.style.background = 'rgba(5, 150, 105, 0.1)';
            });
        });

        // Copy functionality for API link
        document.querySelectorAll('.api-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                navigator.clipboard.writeText(this.href).then(() => {
                    const original = this.textContent;
                    this.textContent = '✅ Copied!';
                    setTimeout(() => this.textContent = original, 2000);
                });
            });
        });
    </script>
</body>
</html>`;
  }

  static generateBreadcrumbs(endpoint) {
    const parts = endpoint.split('/').filter(Boolean);
    const breadcrumbs = ['Home'];

    if (parts[0] === 'api') {
      breadcrumbs.push('API');
      if (parts[1]) breadcrumbs.push(parts[1].toUpperCase());
      if (parts[2]) breadcrumbs.push(parts[2].replace('-', ' '));
    }

    return `
      <div class="breadcrumbs">
        ${breadcrumbs.map((crumb, index) => `
          <span class="breadcrumb-item">
            ${index > 0 ? '<span>→</span>' : ''}
            <span>${crumb}</span>
          </span>
        `).join('')}
      </div>
    `;
  }

  static generateTable(data, tableName) {
    if (!data || data.length === 0) {
      return '<div style="padding: 40px; text-align: center; color: #64748b;">No data available</div>';
    }

    const headers = Object.keys(data[0]);

    return `
      <table>
        <thead>
          <tr>
            ${headers.map(header => `<th>${this.formatHeader(header)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              ${headers.map(header => `<td>${this.formatCell(header, row[header])}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  static generateObjectTable(data) {
    const entries = Object.entries(data);

    return `
      <table>
        <thead>
          <tr>
            <th>Property</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map(([key, value]) => `
            <tr>
              <td><strong>${this.formatHeader(key)}</strong></td>
              <td>${this.formatValue(value)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  static formatHeader(header) {
    return header
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  static formatCell(header, value) {
    if (value === null || value === undefined) return '<em>N/A</em>';

    // Format specific fields
    if (header.includes('date') || header.includes('time')) {
      return new Date(value).toLocaleDateString();
    }

    if (header.includes('status')) {
      return `<span class="badge badge-success">${value}</span>`;
    }

    if (header.includes('category') || header.includes('type')) {
      return `<span class="badge badge-primary">${value}</span>`;
    }

    if (typeof value === 'object') {
      return `<code>${JSON.stringify(value, null, 2)}</code>`;
    }

    return String(value);
  }

  static formatValue(value) {
    if (value === null || value === undefined) return '<em>null</em>';
    if (typeof value === 'boolean') return value ? '✅ True' : '❌ False';
    if (typeof value === 'object') return `<pre>${JSON.stringify(value, null, 2)}</pre>`;
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  }
}

module.exports = ResponseHandler;