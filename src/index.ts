const express = require("express");
import { ApolloServer, gql, ApolloError } from "apollo-server-express";
import { v4 as uuid } from "uuid";
import { name } from "faker";
import fetch from "isomorphic-fetch";
import { Resolvers, Dog, Person, Breed } from "./generated/graphql";
import http from "http";
// The GraphQL schema
const typeDefs = gql`
  enum Breed {
    LABRADOR
    POODLE
  }

  type Person {
    id: ID!
    firstName: String!
    lastName: String!
    dogs: [Dog!]!
  }

  type Dog {
    id: ID!
    name: String!
    breed: Breed!
    photo: String!
    likes: Int!
    owner: Person!
  }

  type Query {
    people: [Person!]!
    person(id: ID!): Person
    dogs: [Dog!]!
    dog(id: ID!): Dog
  }

  type Mutation {
    renameDog(dogId: ID!, newName: String!): Dog
    likeDog(dogId: ID!): Dog
    renameOwner(
      personId: ID!
      newFirstName: String
      newLastName: String
    ): Person
  }
`;

const getDogImage = async () => {
  const data = await fetch("https://dog.ceo/api/breeds/image/random");
  const json = await data.json();
  return json["message"];
};

const getDogs = (): Promise<Omit<Dog, "owner">[]> => {
  const dogPromises = Array(20)
    .fill(null)
    .map(async () => ({
      id: uuid(),
      name: name.prefix() + " " + name.firstName(),
      breed: Math.random() > 0.5 ? Breed.Labrador : Breed.Poodle,
      photo: await getDogImage(),
      likes: 0,
    }));

  return Promise.all(dogPromises);
};

const getPeople = (): Person[] =>
  Array(2)
    .fill(null)
    .map(() => ({
      id: uuid(),
      firstName: name.firstName(),
      lastName: name.lastName(),
      dogs: [] as Dog[],
    }));

const setUp = async () => {
  // A map of functions which return data for the schema.

  const owners = getPeople();
  const dogsWithoutOwners = await getDogs();

  const dogs: Dog[] = [];
  for (let dogWithoutOwner of dogsWithoutOwners) {
    let owner = owners[Math.floor(Math.random() * owners.length)];
    const dog = { ...dogWithoutOwner, owner };
    owner.dogs.push(dog);
    dogs.push(dog);
  }
  const resolvers: Resolvers = {
    Query: {
      people: () => owners,
      person: (parent, args, ctx, info) => {
        const requestedPerson = owners.find((owner) => owner.id === args.id);
        return requestedPerson || null;
      },
      dogs: () => dogs,
      dog: (parent, args, ctx, info) => {
        const requestedDog = dogs.find((dog) => dog.id === args.id);
        return requestedDog ? requestedDog : null;
      },
    },
    Mutation: {
      renameOwner: (parent, args, ctx, info) => {
        const requestedPerson = owners.find(
          (person) => person.id === args.personId
        );
        if (!requestedPerson) throw new ApolloError("Dog Not found");

        if (args.newFirstName) requestedPerson.firstName = args.newFirstName;
        if (args.newLastName) requestedPerson.lastName = args.newLastName;

        return requestedPerson;
      },
      renameDog: (parent, args, ctx, info) => {
        const requestedDog = dogs.find((dog) => dog.id === args.dogId);
        if (!requestedDog) throw new ApolloError("Dog Not found");

        requestedDog.name = args.newName;

        return requestedDog;
      },
      likeDog: (parent, args, ctx, info) => {
        const requestedDog = dogs.find((dog) => dog.id === args.dogId);
        if (!requestedDog) throw new ApolloError("Dog Not found");

        requestedDog.likes++;

        return requestedDog;
      },
    },
  };

  const app = express();

  app.use((req, res, next) => {
    setTimeout(next, 500);
  });
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    debug: false,
  });
  await server.start();
  server.applyMiddleware({ app });
  const httpServer = http.createServer(app);

  await new Promise<void>((resolve) =>
    httpServer.listen({ port: 4000 }, () => resolve())
  );
  console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`);
};

setUp();
