import axios from "axios";


export async function transpileQuery(props) {
    const { dialect, format, query } = props;
    const url = `https://secure-api.starlake.ai/api/v1/transpiler/transpile?dialect=${dialect}&format=${format}`;
    // const url = `/api/v1/transpiler/transpile?dialect=${dialect}&format=${format}`;

    try {
        const response = await axios.post(url, query, {
            headers: {
                'accept': 'text/plain',
                'Content-Type': 'text/plain',
            }
        });

        return response.data;
    } catch (error) {
        throw error;
    }
}

