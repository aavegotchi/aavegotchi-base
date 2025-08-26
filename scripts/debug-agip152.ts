import { request, gql } from "graphql-request";

const SNAPSHOT_ENDPOINT = "https://hub.snapshot.org/graphql";

const PROPOSAL_QUERY = gql`
  query GetProposal($id: String!) {
    proposal(id: $id) {
      id
      title
      body
      state
      scores
      scores_total
      votes
      quorum
      created
      end
      author
      choices
      snapshot
      space {
        id
        name
      }
    }
  }
`;

async function checkProposal() {
  const proposalId =
    "0xfcf7bb54537fcbf9c3fa181a4dbcd525702c52b1e01d24e72e735d46564b4bb4";

  try {
    const data = await request(SNAPSHOT_ENDPOINT, PROPOSAL_QUERY, {
      id: proposalId,
    });

    if (data.proposal) {
      console.log("✅ Found the sigprop for AGIP 152!");
      console.log("Title:", data.proposal.title);
      console.log("State:", data.proposal.state);
      console.log("Votes:", data.proposal.votes);
      console.log("Scores Total:", data.proposal.scores_total);
      console.log("Scores:", data.proposal.scores);
      console.log("Quorum:", data.proposal.quorum);
      console.log(
        "Created:",
        new Date(data.proposal.created * 1000).toISOString()
      );

      // Check if it would pass our filtering criteria
      const hasQuorum = data.proposal.quorum
        ? data.proposal.scores_total >= data.proposal.quorum
        : data.proposal.scores_total >= 7200000; // Default threshold

      // Use the same logic as our updated script with Aavegotchi DAO rules
      const hasPassed =
        data.proposal.scores &&
        data.proposal.scores.length > 0 &&
        (() => {
          const scores = data.proposal.scores;
          const totalVotes = data.proposal.scores_total;
          const numOptions = scores.length;

          // Find the winning option (highest votes)
          const maxVotes = Math.max(...scores);
          const winningIndex = scores.indexOf(maxVotes);

          // Calculate percentages
          const percentages = scores.map(
            (score: number) => (score / totalVotes) * 100
          );
          const winningPercentage = percentages[winningIndex];

          // Find the second highest percentage to calculate differential
          const sortedPercentages = [...percentages].sort((a, b) => b - a);
          const secondHighestPercentage = sortedPercentages[1] || 0;
          const differential = winningPercentage - secondHighestPercentage;

          // Apply Aavegotchi DAO voting rules
          let requiredDifferential;
          switch (numOptions) {
            case 2:
              requiredDifferential = 10;
              break;
            case 3:
              requiredDifferential = 15;
              break;
            case 4:
              requiredDifferential = 20;
              break;
            default:
              requiredDifferential = 20 + (numOptions - 4) * 5;
              break;
          }

          console.log("\\nVoting Analysis:");
          console.log("Number of options:", numOptions);
          console.log("Required differential:", requiredDifferential + "%");
          console.log(
            "Winning percentage:",
            winningPercentage.toFixed(1) + "%"
          );
          console.log(
            "Second highest:",
            secondHighestPercentage.toFixed(1) + "%"
          );
          console.log("Actual differential:", differential.toFixed(1) + "%");

          return differential >= requiredDifferential;
        })();

      console.log("Reached Quorum:", hasQuorum);
      console.log("Passed:", hasPassed);

      if (!hasQuorum || !hasPassed) {
        console.log(
          "❌ This explains why AGIP 152 wasn't matched - the sigprop didn't meet our criteria"
        );
      } else {
        console.log(
          "✅ This sigprop should have been included - there might be a bug in our fetching logic"
        );
      }
    } else {
      console.log("❌ Proposal not found");
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

checkProposal();
