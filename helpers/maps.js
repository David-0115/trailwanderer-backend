//Use OSM API to get map data
const axios = require('axios')



async function searchTrailByName(trailName, state) {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trailName)}+${encodeURIComponent(state)}&format=json&addressdetails=1`;

    try {
        const response = await axios.get(nominatimUrl, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'trail-wanderer.com (trailwanderer.web@gmail.com)'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error querying Nominatim API:', error);
        throw error;
    }
}



module.exports = { searchTrailByName };