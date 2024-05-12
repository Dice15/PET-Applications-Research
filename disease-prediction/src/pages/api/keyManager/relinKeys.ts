import MongoDbProvider from "@/core/modules/database/MongoDbProvider";
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
    const db = await MongoDbProvider.getDb(process.env.MONGODB_URI);
    const session = await getServerSession(request, response, authOptions)

    if (!session) {
        response.status(401).json({ message: "Unauthorized", data: null });
        return;
    }

    switch (request.method) {
        case "GET": {
            try {
                const result = await db.collection("relinkeys").findOne({
                    id: session.user.id,
                });
                response.status(200).json({ message: "SUCCESS", data: { serializedRelinKeys: result ? result.relinkeys as string : null } });
            }
            catch (error) {
                response.status(502).json({ message: "Database error", error: error });
            }
            break;
        }
        case "POST": {
            const { serializedRelinKeys } = request.body;
            try {
                const result = await db.collection("relinkeys").insertOne({
                    id: session.user.id,
                    name: session.user.name,
                    email: session.user.email,
                    relinkeys: serializedRelinKeys,
                });
                response.status(200).json({ message: "SUCCESS", data: { id: result.insertedId.toString() } });
            }
            catch (error) {
                response.status(502).json({ message: "Database error", error: error });
            }
            break;
        }
        case "DELETE": {
            try {
                const result = await db.collection("relinkeys").deleteMany({
                    id: session.user.id,
                });
                response.status(200).json({ message: "SUCCESS", data: { deletedCount: result.deletedCount } });
            }
            catch (error) {
                response.status(502).json({ message: "Database error", error: error });
            }
            break;
        }
        default: {
            response.setHeader("Allow", ["GET", "POST", "DELETE"]);
            response.status(405).end(`Method ${request.method} Not Allowed`);
        }
    }
}