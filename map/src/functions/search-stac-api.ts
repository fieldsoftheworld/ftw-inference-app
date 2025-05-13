// Store the currently selected feature
let selectedFeature = null;
let currentMgrsTileId = null;
let nextPageToken: string | null = null;
let currentStacLayerId = null;

interface SearchResult {
  id: string;
  date: string;
  cloudCover: number | string;
  thumbnailUrl: string;
  bounds: number[] | null;
}

interface ProcessedResult extends Omit<SearchResult, 'date'> {
  date: Date;
  formattedDate: string;
}

// References to DOM elements
const searchResults = document.getElementById('search-results');
const searchStatus = document.getElementById('search-status');
const nextPageBtn = document.getElementById('next-page-btn');

// Function to search the STAC API
export default async function searchStacApi(mgrsTileId: string, resetSearch = true) {
  // Store the current MGRS tile ID for pagination
  currentMgrsTileId = mgrsTileId;
  const startDate = (document.getElementById('start-date') as HTMLInputElement)?.value;
  const endDate = (document.getElementById('end-date') as HTMLInputElement)?.value;
  const cloudCover = (document.getElementById('cloud-cover') as HTMLInputElement)?.value || 10;

  // If resetting search, clear previous results and token
  // if (resetSearch) {
  //   searchResults.innerHTML = '';
  //   nextPageToken = null;
  // }

  //   // Show status
  //   searchStatus.innerHTML = resetSearch ?
  //       // Get values from the form
  //   c`Searching for Sentinel-2 images in tile ${mgrsTileId}...` :
  //       'Loading more results...';

  //   // Disable next button while loading
  //   nextPageBtn.disabled = true;

    try {
        // Build the date constraint if dates are provided
        let dateConstraint = '';
        if (startDate && endDate) {
            dateConstraint = `&datetime=${startDate}/${endDate}`;
        } else if (startDate) {
            dateConstraint = `&datetime=${startDate}/..`;
        } else if (endDate) {
            dateConstraint = `&datetime=../${endDate}`;
        }

        // Create the CQL filter and encode it for URL
        const cqlFilter = encodeURIComponent(`eo:cloud_cover<${cloudCover} AND s2:mgrs_tile='${mgrsTileId}'`);

        // Construct the URL with query parameters and a limit of 20 results
        let searchUrl = `https://planetarycomputer.microsoft.com/api/stac/v1/search?collections=sentinel-2-l2a${dateConstraint}&filter-lang=cql2-text&filter=${cqlFilter}&limit=20`;

        // Add the pagination token if we're loading more results
        if (!resetSearch && nextPageToken) {
            searchUrl += `&token=${encodeURIComponent(nextPageToken)}`;
        }

        // Make the GET request
        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/geo+json'
            }
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Look for the "next" link which contains the pagination token
        let nextLink = null;
        if (data.links) {
            nextLink = data.links.find((link: { rel: string; }) => link.rel === 'next');
        }

        // Store the pagination token if available
        if (nextLink && nextLink.href) {
            // Extract token from the URL
            const tokenMatch = nextLink.href.match(/token=([^&]+)/);
            if (tokenMatch && tokenMatch[1]) {
                nextPageToken = decodeURIComponent(tokenMatch[1]);
                // nextPageBtn.disabled = false;
            } else {
                nextPageToken = null;
                // nextPageBtn.disabled = true;
            }
        } else {
            nextPageToken = null;
            // nextPageBtn.disabled = true;
        }

        // Process and sort the results
        const results = data.features
            .map((item: any): ProcessedResult => {
                const result = {
                    id: item.id,
                    date: new Date(item.properties.datetime),
                    formattedDate: new Date(item.properties.datetime).toLocaleDateString(),
                    cloudCover: item.properties["eo:cloud_cover"] || "N/A",
                    thumbnailUrl: item.assets?.rendered_preview?.href || '#',
                    bounds: item.bbox ? (item.bbox.length === 6 ?
                        [item.bbox[0], item.bbox[1], item.bbox[3], item.bbox[4]] :
                        item.bbox) : null
                };
                return result;
            })
            .sort((a: ProcessedResult, b: ProcessedResult) => {
                // First sort by date (newest first)
                const dateComparison = b.date.getTime() - a.date.getTime();
                if (dateComparison !== 0) return dateComparison;

                // If dates are equal, sort by cloud cover (lowest first)
                const aCloudCover = typeof a.cloudCover === 'number' ? a.cloudCover : Infinity;
                const bCloudCover = typeof b.cloudCover === 'number' ? b.cloudCover : Infinity;
                return aCloudCover - bCloudCover;
            })
            .map((item: ProcessedResult): SearchResult => ({
                ...item,
                date: item.formattedDate // Convert back to string for display
            }));

        return {
            results,
            hasMore: !!nextPageToken,
            totalFound: data.features.length
        };

    } catch (error) {
        console.error("Error searching STAC API:", error);
        // searchStatus.innerHTML = `Error searching STAC API: ${error.message}`;
//         nextPageBtn.disabled = true;
    }
}

// // Add event listener for the Next button
// document.addEventListener('DOMContentLoaded', () => {
//     nextPageBtn.addEventListener('click', () => {
//         if (currentMgrsTileId) {
//             searchStacApi(currentMgrsTileId, false);
//         }
//     });

//     // Add event listeners for the date inputs (to trigger immediate search when changed)
//     document.getElementById('start-date').addEventListener('change', () => {
//         if (currentMgrsTileId) {
//             searchStacApi(currentMgrsTileId, true);
//         }
//     });

//     document.getElementById('end-date').addEventListener('change', () => {
//         if (currentMgrsTileId) {
//             searchStacApi(currentMgrsTileId, true);
//         }
//     });

//     document.getElementById('cloud-cover').addEventListener('change', () => {
//         if (currentMgrsTileId) {
//             searchStacApi(currentMgrsTileId, true);
//         }
//     });
// });

// Make searchStacApi globally available
// window.searchStacApi = searchStacApi;
