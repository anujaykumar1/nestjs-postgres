import { ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime";
import { hash, verify } from "argon2";
import { PrismaService } from "src/prisma/prisma.service";
import { AuthDto } from "./dto";

@Injectable()
export class AuthService {

    constructor(private prisma: PrismaService, private jwt: JwtService, private config: ConfigService) {

    }

    async signin(dto: AuthDto) {
        /**
         * provide email 
         * if !exist throw exception
         * compare password
         * !correct then thrwo exception
         * if all right then return user
         */
        const user = await this.prisma.user.findUnique({
            where: {
                email: dto.email
            }
        });

        if (!user) {
            throw new ForbiddenException("User doesnot exists");
        }
        const pwMatches = await verify(user.hash, dto.password);

        if (!pwMatches) {
            throw new ForbiddenException("Incorrect password");

        }
        return this.signToken(user.id, user.email)
    }

    async signup(dto: AuthDto) {
        /**
        * generate the password hash
        * save new entry in db
        * return saved user
        */
        const generatedHash = await hash(dto.password)
        try {
            const user = await this.prisma.user.create({
                data: {
                    email: dto.email,
                    hash: generatedHash
                }
                // ,
                // select: {
                //     id: true,
                //     createdAt: true,
                //     firstName: true,
                //     lastName: true
                // }
            });
            return this.signToken(user.id, user.email)

        } catch (error) {
            console.log(error)
            if (error instanceof PrismaClientKnownRequestError) {
                if (error.code === 'P2002') {
                    // P2002 is for duplicate entry
                    throw new ForbiddenException("Credentials Taken")
                }
            } else {
                throw error;
            }
        }
    }

    async signToken(userId: number, email: string): Promise<{ access_token: string }> {
        const payload = {
            sub: userId,
            email
        }
        const token = await this.jwt.signAsync(payload, {
            expiresIn: '15m',
            secret: this.config.get('JWT_SECRET')
        })
        return {
            access_token: token
        }
    }
}