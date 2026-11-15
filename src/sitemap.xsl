<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
<xsl:output method="html" encoding="UTF-8"/>
<xsl:template match="/">
<html lang="en"><head><meta charset="utf-8"/><meta name="robots" content="noindex"/><title>Sitemap | Ruta Shuttle</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:40px auto;max-width:1000px;padding:0 20px;color:#1f2d3d}h1{font-size:22px}p{color:#5b6b7b}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e3e8ee}th{background:#f3f6f9}a{color:#1e5aa8;text-decoration:none}</style></head>
<body><h1>Ruta Shuttle sitemap</h1><p>This is the XML sitemap read by Google, Bing and AI crawlers. It lists <xsl:value-of select="count(s:urlset/s:url)"/> pages in English and Spanish.</p>
<table><tr><th>Page</th><th>Images</th><th>Last updated</th></tr>
<xsl:for-each select="s:urlset/s:url"><tr><td><a href="{s:loc}"><xsl:value-of select="s:loc"/></a></td><td><xsl:value-of select="count(image:image)"/></td><td><xsl:value-of select="s:lastmod"/></td></tr></xsl:for-each>
</table></body></html>
</xsl:template></xsl:stylesheet>
